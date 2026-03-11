import socket
import json
import urllib.request
import sys
import time
import base64
from datetime import datetime
import subprocess
import os
import threading
import tempfile
import queue
import http.client
import builtins

# Отключаем print
builtins.print = lambda *args, **kwargs: None

API_HOST = "127.0.0.1"
API_PORT_LISTEN = 6320
API_PORT_SEND = 6321

LOCK_PATH = os.path.join(tempfile.gettempdir(), "sd_helper.lock")
TIMEOUT = 5 * 60  # 5 минут

SD_HOST = "127.0.0.1"
SD_PORT = 7860

last_request_time = time.time()
generation_queue = queue.Queue()
worker_thread = None
worker_stop_event = threading.Event()
current_stop_event = None
ack_event = threading.Event()


def timestamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def encode_file_to_base64(path, remove=False):
    print(f"[DEBUG] Кодировка файла в base64: {path}")
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    if remove:
        os.remove(path)
        print(f"[DEBUG] Временный файл удалён: {path}")
    return f"data:image/png;base64,{encoded}"


def decode_and_save_base64(base64_str, save_path):
    print(f"[DEBUG] Сохранение изображения: {save_path}")
    with open(save_path, "wb") as f:
        f.write(base64.b64decode(base64_str))


def send_data_to_jsx(message):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((API_HOST, API_PORT_SEND))
            s.sendall(json.dumps(message).encode("utf-8"))
        return True

    except Exception as e:
        print(f"[WARN] Ошибка отправки: {e}")
        return False


def check_module(module_name):
    try:
        __import__(module_name)
        print(f"[DEBUG] Модуль {module_name} уже установлен")
        return True
    except ImportError:
        print(f"[INFO] Модуль {module_name} не найден, установка...")
        return install_module(module_name)


def install_module(module_name):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", module_name])
        print(f"[INFO] Модуль {module_name} успешно установлен")
        return True
    except:
        print(f"[ERROR] Ошибка установки модуля {module_name}")
        return False


def timeout_watcher():
    global last_request_time
    while True:
        time.sleep(5)
        if time.time() - last_request_time > TIMEOUT:
            print("[INFO] Сервер простаивал 5 минут → завершение")
            if os.path.exists(LOCK_PATH):
                os.remove(LOCK_PATH)
            os._exit(0)


def safe_interrupt():
    global SD_HOST, SD_PORT
    try:
        print("[DEBUG] Отправка interrupt в SD (safe)...")

        def worker():
            try:
                conn = http.client.HTTPConnection(SD_HOST, SD_PORT, timeout=10)
                conn.request("POST", "/sdapi/v1/interrupt", "")
                resp = conn.getresponse()
                resp.read()
                conn.close()
                print("[INFO] Прерывание безопасно отправлено")
            except Exception as e:
                print(f"[WARN] Ошибка safe interrupt: {e}")

        threading.Thread(target=worker, daemon=True).start()
    except Exception as e:
        print(f"[WARN] Ошибка запуска safe_interrupt: {e}")


def wait_until_sd_ready(timeout=60):
    global SD_HOST, SD_PORT

    print("[INFO] Ожидание готовности Forge...")
    start = time.time()

    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(
                f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/progress", timeout=5
            ) as resp:
                data = json.loads(resp.read().decode())
                job = data.get("state", {}).get("job", "")
                if not job:
                    print("[INFO] Forge свободен")
                    return True
                else:
                    print("[DEBUG] Forge занят, ждём...")
        except Exception as e:
            print(f"[WARN] Ошибка проверки готовности: {e}")

        time.sleep(1)

    print("[WARN] Forge не ответил вовремя")
    return False


def post_with_retry(req, retries=3, delay=2):
    for attempt in range(retries):
        try:
            print(f"[DEBUG] Попытка POST #{attempt+1}")
            return urllib.request.urlopen(req, timeout=180)
        except Exception as e:
            print(f"[WARN] Ошибка POST: {e}")

            if attempt < retries - 1:
                print(f"[INFO] Повтор через {delay} сек...")
                time.sleep(delay)
            else:
                print("[ERROR] Все попытки POST исчерпаны")
                raise


def mask_large_data(obj, max_len=100):
    """
    Рекурсивно создает копию объекта, заменяя длинные строки на '<DATA OMITTED>'.
    """
    if isinstance(obj, dict):
        return {k: mask_large_data(v, max_len) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [mask_large_data(v, max_len) for v in obj]
    elif isinstance(obj, str):
        return "<DATA OMITTED>" if len(obj) > max_len else obj
    else:
        return obj


def call_generate_api(api_endpoint, payload, out_dir, stop_event, skipInit):
    global SD_HOST, SD_PORT  # должно быть в самом начале

    print(f"[INFO] Запуск генерации через {api_endpoint}")
    print(mask_large_data(payload))

    if not wait_until_sd_ready():
        err = "[ERROR] Forge не готов к генерации"
        print(err)
        send_data_to_jsx({"type": "error", "message": err})
        return

    generation_done = threading.Event()
    generation_result = {"path": None}

    def progress_watcher():
        init_sent = False

        # --- Если skipInit, просто ждём завершения генерации ---
        if skipInit:
            generation_done.wait()
            send_data_to_jsx({"type": "answer", "message": generation_result["path"]})
            return

        # --- Ждём начала sampling ---
        while not stop_event.is_set() and not generation_done.is_set():
            try:
                with urllib.request.urlopen(
                    f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/progress", timeout=5
                ) as resp:
                    data = json.loads(resp.read().decode())
                    step = data["state"].get("sampling_step", 0)

                    if step > 0:
                        print("[INFO] Отправка init в JSX")

                        ack_event.clear()
                        send_data_to_jsx({"type": "answer", "message": "init"})

                        # Ждём подтверждение максимум 5 секунд
                        if not ack_event.wait(timeout=5):
                            print(
                                "[WARN] JSX не подтвердил init за 5 секунд, продолжаем"
                            )
                        else:
                            print("[INFO] ACK получен")

                        init_sent = True
                        break

            except Exception as e:
                print(f"[WARN] Ошибка progress watcher: {e}")

            time.sleep(0.3)

        # --- Если генерация завершилась слишком быстро ---
        if not init_sent:
            print("[INFO] Генерация завершилась до sampling_step > 0")

            ack_event.clear()
            send_data_to_jsx({"type": "answer", "message": "init"})

            if not ack_event.wait(timeout=5):
                print("[WARN] JSX не подтвердил init за 5 секунд, продолжаем")
            else:
                print("[INFO] ACK получен")

            init_sent = True

        # --- Ждём окончания генерации ---
        generation_done.wait()

        # --- Отправляем путь к файлу ---
        send_data_to_jsx({"type": "answer", "message": generation_result["path"]})

    threading.Thread(target=progress_watcher, daemon=True).start()

    try:
        # --- Отправка POST на SD ---
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"http://{SD_HOST}:{SD_PORT}/{api_endpoint}",
            headers={"Content-Type": "application/json"},
            data=data,
        )

        print("[DEBUG] Отправка POST в SD...")
        with post_with_retry(req) as resp:
            result = json.loads(resp.read().decode())

        if stop_event.is_set():
            generation_done.set()
            return

        # --- Сохраняем результат ---
        if "images" in result and result["images"]:
            last_path = None
            for i, image in enumerate(result["images"]):
                save_path = os.path.join(out_dir, f"{timestamp()}-{i}.jpg")
                decode_and_save_base64(image, save_path)
                last_path = save_path
            generation_result["path"] = last_path

        elif "image" in result and result["image"]:
            save_path = os.path.join(out_dir, f"{timestamp()}.jpg")
            decode_and_save_base64(result["image"], save_path)
            generation_result["path"] = save_path

        else:
            generation_result["path"] = None

        print("[INFO] Генерация завершена")

    except Exception as e:
        print(f"[ERROR] Ошибка генерации: {e}")
        send_data_to_jsx({"type": "error", "message": str(e)})
        generation_result["path"] = None

    finally:
        generation_done.set()


def find_image(obj):
    """Рекурсивный поиск data:image"""
    if isinstance(obj, dict):
        for v in obj.values():
            result = find_image(v)
            if result:
                return result
    elif isinstance(obj, list):
        for v in obj:
            result = find_image(v)
            if result:
                return result
    elif isinstance(obj, str):
        if obj.startswith("data:image"):
            return obj
    return None


def call_external_api(data, out_dir, stop_event):

    if check_module("requests"):
        import requests
        
    provider = data.get("provider", "classic")

    headers = {"Authorization": f"Bearer {data['apiKey']}"}

    files = []

    try:

        print(f"[API] provider={provider}")

        # =====================================================
        # CLASSIC API
        # =====================================================

        if provider == "classic":

            files = [("image_urls[]", open(data["input"], "rb"))]

            if data.get("reference"):
                files.append(("image_urls[]", open(data["reference"], "rb")))

            form_data = {
                "prompt": str(data["prompt"]),
                "num_images": str(len(files)),
                "output_format": "png",
                "callback_url": None,
                "is_sync": not bool(data.get("apiStatus")),
            }

            if data.get("resolution"):
                form_data["resolution"] = data["resolution"]

            if data.get("aspect_ratio"):
                form_data["aspect_ratio"] = data["aspect_ratio"]

            print("[API] sending request")

            resp = requests.post(
                data["apiEndpoint"],
                headers=headers,
                data=form_data,
                files=files,
                timeout=180,
            )

            resp.raise_for_status()

            resp_json = resp.json()

            # ---------- sync ----------

            if not data.get("apiStatus"):

                result_url = resp_json.get("result", [None])[0]

                if not result_url:
                    raise Exception(f"Invalid API response: {resp_json}")

            # ---------- async ----------

            else:

                request_id = resp_json.get("request_id")

                if not request_id:
                    raise Exception(f"Invalid API response: {resp_json}")

                while not stop_event.is_set():

                    status_resp = requests.get(
                        data["apiStatus"].format(request_id),
                        headers=headers,
                        timeout=30,
                    )

                    status_json = status_resp.json()

                    status = status_json.get("status")

                    if status == "success":
                        result_url = status_json.get("result", [None])[0]
                        break

                    if status == "error":
                        raise Exception(status_json)

                    time.sleep(3)

                else:
                    print("[API] cancelled")
                    return

            print("[API] downloading result")

            img_bytes = requests.get(result_url).content

            save_path = os.path.join(out_dir, f"{timestamp()}-1.png")

            with open(save_path, "wb") as f:
                f.write(img_bytes)

            send_data_to_jsx({"type": "answer", "message": save_path})

            print("[API] done")

        # =====================================================
        # OPENAI STYLE API
        # =====================================================

        elif provider == "openai":

            print("[API] encoding images")

            content = [
                {"type": "text", "text": str(data["prompt"])},
                {
                    "type": "image_url",
                    "image_url": {"url": encode_file_to_base64(data["input"])},
                },
            ]

            if data.get("reference"):
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": encode_file_to_base64(data["reference"])},
                    }
                )

            payload = {
                "model": str(data["model"]),
                "messages": [{"role": "user", "content": content}],
            }

            # ---------- image_config ----------

            image_config = {}

            if data.get("aspect_ratio"):
                image_config["aspect_ratio"] = data["aspect_ratio"]

            if data.get("resolution"):
                image_config["image_size"] = data["resolution"]

            # Gemini-style параметры
            if image_config:

                payload["extra_body"] = {
                    "image_config": image_config,
                    "response_modalities": ["IMAGE"],
                }

            headers["Content-Type"] = "application/json"

            print("[API] sending request")

            resp = requests.post(
                data["apiEndpoint"],
                headers=headers,
                json=payload,
                timeout=300,
            )

            resp.raise_for_status()

            resp_json = resp.json()

            data_url = find_image(resp_json)

            if not data_url:
                raise Exception(f"Image not found in response: {resp_json}")

            base64_data = data_url.split(",", 1)[1]

            save_path = os.path.join(out_dir, f"{timestamp()}-1.png")

            decode_and_save_base64(base64_data, save_path)

            send_data_to_jsx({"type": "answer", "message": save_path})

            print("[API] done")

        else:
            raise Exception(f"Unknown provider: {provider}")

    except Exception as e:

        print("[API ERROR]", e)

        send_data_to_jsx({"type": "error", "message": str(e)})

    finally:

        for _, f in files:
            try:
                f.close()
            except:
                pass


def generation_worker():
    global current_stop_event

    while not worker_stop_event.is_set():
        try:
            task_type, entrypoint, payload, out_dir, skipInit = generation_queue.get(
                timeout=1
            )
        except queue.Empty:
            continue

        print(f"[WORKER] Выполняется задача: {task_type}")

        current_stop_event = threading.Event()

        if task_type == "local":
            call_generate_api(
                entrypoint, payload, out_dir, current_stop_event, skipInit
            )
        elif task_type == "remote":
            call_external_api(payload, out_dir, current_stop_event)

        generation_queue.task_done()
        print("[WORKER] Задача завершена")


def enqueue_generation(task_type, entrypoint, payload, out_dir, skipInit):
    generation_queue.put((task_type, entrypoint, payload, out_dir, skipInit))
    print(f"[QUEUE] Задача добавлена в очередь: {task_type}")


def get_data_from_SD(api_name):
    global SD_HOST, SD_PORT
    url = f"http://{SD_HOST}:{SD_PORT}/{api_name}"
    print(f"[DEBUG] Запрос к SD: {url}")
    try:
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"[ERROR] Ошибка получения данных: {e}")
        return None


def handle_client(client_socket):
    global SD_HOST, SD_PORT, current_stop_event, last_request_time

    try:
        message = client_socket.recv(8192)
        if not message:
            return

        message = json.loads(message.decode().rstrip("\n"))
        last_request_time = time.time()

        msg_type = message.get("type")
        print(f"[DEBUG] Получено сообщение: {msg_type}")

        # INTERRUPT
        if msg_type == "interrupt":
            print("[INFO] Запрошено прерывание")
            if current_stop_event:
                current_stop_event.set()
            safe_interrupt()

        # HANDSHAKE
        elif msg_type == "handshake":
            data = message["message"]
            SD_HOST = data["sdHost"]
            SD_PORT = int(data["sdPort"])
            print(f"[INFO] Новый SD endpoint: {SD_HOST}:{SD_PORT}")
            send_data_to_jsx({"type": "answer", "message": "success"})

        # PING
        elif msg_type == "ping":
            result = False
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(0.1)
                    result = s.connect_ex((SD_HOST, SD_PORT)) == 0
            except Exception:
                result = False

            send_data_to_jsx({"type": "answer", "message": result})

        # PAYLOAD
        elif msg_type == "local":
            data = message["message"]
            print(f"[INFO] Запрос генерации получен {message}")

            init_image = encode_file_to_base64(data["input"], True)
            entrypoint = "sdapi/v1/img2img"

            payload = {
                "prompt": data["prompt"],
                "negative_prompt": data["negative_prompt"],
                "sampler_name": data["sampler_name"],
                "scheduler": data["scheduler"],
                "cfg_scale": data["cfg_scale"],
                "seed": -1,
                "steps": data["steps"],
                "width": data["width"],
                "height": data["height"],
                "denoising_strength": data["denoising_strength"],
                "n_iter": 1,
                "init_images": [init_image],
            }

            # FLUX
            if "flux" in data:
                payload["distilled_cfg_scale"] = data["cfg_scale"]
                payload["cfg_scale"] = 1

            # INPAINT
            if "mask" in data:
                payload["mask"] = encode_file_to_base64(data["mask"], True)
                payload["inpainting_fill"] = data["inpainting_fill"]
                payload["image_cfg_scale"] = 1.5
                payload["inpaint_full_res"] = 0
                payload["initial_noise_multiplier"] = 1
                payload["resize_mode"] = 2

            # KONTEXT
            if "kontext" in data:
                print("[INFO] Режим Forge FluxKontext")
                reference = (
                    encode_file_to_base64(data["reference"], True)
                    if "reference" in data
                    else None
                )
                payload["alwayson_scripts"] = {
                    "Forge FluxKontext": {
                        "args": [True, init_image, reference, "to output", False]
                    }
                }
                del payload["init_images"]
                entrypoint = "sdapi/v1/txt2img"

            # IMAGE STITCH
            elif "stitch" in data:
                print("[INFO] Режим ImageStitch")
                reference = (
                    encode_file_to_base64(data["reference"], True)
                    if "reference" in data
                    else None
                )
                payload["alwayson_scripts"] = {
                    "ImageStitch Integrated": {"args": [True, [reference]]}
                }

            enqueue_generation("local", entrypoint, payload, data["output"], False)

        # FACE RESTORE
        elif msg_type == "faceRestore":
            print("[INFO] Запрос восстановления лица")
            data = message["message"]
            init_image = encode_file_to_base64(data["input"], True)
            payload = {"image": init_image}

            if data.get("gfpgan") == "true":
                payload["gfpgan_visibility"] = data["gfpgan_visibility"]

            if data.get("codeformer") == "true":
                payload["codeformer_visibility"] = data["codeformer_visibility"]
                payload["codeformer_weight"] = data["codeformer_weight"]

            enqueue_generation(
                "local", "sdapi/v1/extra-single-image", payload, data["output"], True
            )

        # API
        elif msg_type == "api":
            data = message["message"]
            print(f"[INFO] Получен запрос внешнего API: {data}")

            # Создаём payload для remote
            remote_payload = {
                "provider": data["provider"],
                "apiKey": data["apiKey"],
                "apiEndpoint": data["apiEndpoint"],
                "apiStatus": data.get("apiStatus"),
                "model": data.get("model"),
                "input": data["input"],
                "reference": data.get("reference"),  # может быть None
                "prompt": str(data["prompt"]),
                "aspect_ratio": data.get("aspect_ratio"),
                "resolution": data.get("resolution"),
            }

            # Добавляем задачу в очередь
            enqueue_generation("remote", None, remote_payload, data["output"], True)

        # TRANSLATE
        elif msg_type == "translate":
            print("[INFO] Запрос перевода")
            if check_module("deep_translator"):
                from deep_translator import GoogleTranslator

                try:
                    translated = GoogleTranslator(
                        source="auto", target="english"
                    ).translate(message["message"])
                except:
                    translated = ""
                send_data_to_jsx({"type": "answer", "message": translated})

        # UPDATE
        elif msg_type == "update":
            print("[INFO] Обновление настроек SD {message}")
            data = message["message"]
            with urllib.request.urlopen(
                f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/options"
            ) as resp:
                options = json.load(resp)

            for key in data:
                if data[key] is not None:
                    options[key] = data[key]

            payload = json.dumps(options).encode("utf-8")
            req = urllib.request.Request(
                f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/options",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req) as resp:
                send_data_to_jsx({"type": "answer", "message": resp.read().decode()})

        # GET
        elif msg_type == "get":
            print("[INFO] Получение данных из SD")
            result = get_data_from_SD(message["message"])
            if result is not None:
                send_data_to_jsx(result)

        # ACK
        if msg_type == "ack":
            print("[INFO] Получен ACK от JSX")
            ack_event.set()

    except Exception as e:
        print(f"[ERROR] Ошибка клиента: {e}")

    finally:
        client_socket.close()


def start_local_server():
    global worker_thread

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind((API_HOST, API_PORT_LISTEN))
    srv.listen()

    open(LOCK_PATH, "w").close()
    print("[INFO] Сервер запущен и готов к работе")

    send_data_to_jsx({"type": "answer", "message": "success"})

    threading.Thread(target=timeout_watcher, daemon=True).start()

    if worker_thread is None:
        worker_thread = threading.Thread(target=generation_worker, daemon=True)
        worker_thread.start()
        print("[INFO] Worker генерации запущен")

    while True:
        client_socket, addr = srv.accept()
        print(f"[INFO] Подключение от {addr}")
        threading.Thread(
            target=handle_client, args=(client_socket,), daemon=True
        ).start()


if __name__ == "__main__":
    start_local_server()
