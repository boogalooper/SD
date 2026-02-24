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

# ==============================
# НАСТРОЙКИ
# ==============================

API_HOST = "127.0.0.1"
API_PORT_LISTEN = 6320
API_PORT_SEND = 6321

LOCK_PATH = os.path.join(tempfile.gettempdir(), "sd_helper.lock")
TIMEOUT = 5 * 60

SD_HOST = "127.0.0.1"
SD_PORT = 7860

last_request_time = time.time()

generation_queue = queue.Queue()
worker_thread = None
worker_stop_event = threading.Event()
current_stop_event = None


# ==============================
# ВСПОМОГАТЕЛЬНЫЕ
# ==============================

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
            s.connect((API_HOST, API_PORT_SEND))
            s.sendall(json.dumps(message).encode("utf-8"))
        print(f"[DEBUG] Отправлено в JSX: {message}")
    except Exception as e:
        print(f"[ERROR] Ошибка отправки в JSX: {e}")


# ==============================
# УСТАНОВКА МОДУЛЕЙ
# ==============================

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


# ==============================
# TIMEOUT
# ==============================

def timeout_watcher():
    global last_request_time
    while True:
        time.sleep(5)
        if time.time() - last_request_time > TIMEOUT:
            print("[INFO] Сервер простаивал 5 минут → завершение")
            if os.path.exists(LOCK_PATH):
                os.remove(LOCK_PATH)
            os._exit(0)


# ==============================
# INTERRUPT
# ==============================

def interrupt_generation():
    global SD_HOST, SD_PORT
    try:
        print("[DEBUG] Отправка interrupt в SD...")
        req = urllib.request.Request(
            f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/interrupt",
            data=b"",
            method="POST"
        )
        urllib.request.urlopen(req).close()
        print("[INFO] Прерывание отправлено в SD")
    except Exception as e:
        print(f"[WARN] Ошибка отправки interrupt: {e}")


# ==============================
# ГЕНЕРАЦИЯ
# ==============================

def call_generate_api(api_endpoint, payload, out_dir, stop_event):
    global SD_HOST, SD_PORT

    print(f"[INFO] Запуск генерации через {api_endpoint}")

    def progress_watcher():
        while not stop_event.is_set():
            try:
                with urllib.request.urlopen(
                    f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/progress"
                ) as resp:
                    data = json.loads(resp.read().decode())
                    step = data["state"].get("sampling_step", 0)
                    if step > 0:
                        print(f"[INFO] Прогресс генерации: шаг {step}")
                        send_data_to_jsx({"type": "answer", "message": "init"})
                        break
            except:
                pass
            time.sleep(0.2)

    threading.Thread(target=progress_watcher, daemon=True).start()

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"http://{SD_HOST}:{SD_PORT}/{api_endpoint}",
            headers={"Content-Type": "application/json"},
            data=data
        )

        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())

        if stop_event.is_set():
            print("[INFO] Генерация была прервана")
            return

        if "images" in result:
            for i, image in enumerate(result["images"]):
                save_path = os.path.join(out_dir, f"{timestamp()}-{i}.png")
                decode_and_save_base64(image, save_path)
            send_data_to_jsx({"type": "answer", "message": save_path})

        elif "image" in result:
            save_path = os.path.join(out_dir, f"{timestamp()}.png")
            decode_and_save_base64(result["image"], save_path)
            send_data_to_jsx({"type": "answer", "message": save_path})

        print("[INFO] Генерация успешно завершена")

    except Exception as e:
        if not stop_event.is_set():
            print(f"[ERROR] Ошибка генерации: {e}")
            send_data_to_jsx({"type": "answer", "message": None})


# ==============================
# WORKER
# ==============================

def generation_worker():
    global current_stop_event

    while not worker_stop_event.is_set():
        try:
            entrypoint, payload, out_dir = generation_queue.get(timeout=1)
        except queue.Empty:
            continue

        print(f"[WORKER] Выполняется задача: {entrypoint}")

        current_stop_event = threading.Event()
        call_generate_api(entrypoint, payload, out_dir, current_stop_event)

        generation_queue.task_done()
        print("[WORKER] Задача завершена")


def enqueue_generation(entrypoint, payload, out_dir):
    global current_stop_event

    if current_stop_event and not current_stop_event.is_set():
        print("[QUEUE] Прерывание текущей генерации")
        current_stop_event.set()
        interrupt_generation()

    generation_queue.put((entrypoint, payload, out_dir))
    print("[QUEUE] Задача добавлена в очередь")


# ==============================
# ПОЛУЧЕНИЕ ДАННЫХ SD
# ==============================

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


# ==============================
# ОБРАБОТКА КЛИЕНТА
# ==============================

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
            interrupt_generation()

        # HANDSHAKE
        elif msg_type == "handshake":
            data = message["message"]
            SD_HOST = data["sdHost"]
            SD_PORT = int(data["sdPort"])
            print(f"[INFO] Новый SD endpoint: {SD_HOST}:{SD_PORT}")
            send_data_to_jsx({"type": "answer", "message": "success"})

        # PAYLOAD
        elif msg_type == "payload":
            data = message["message"]
            print("[INFO] Запрос генерации получен")

            init_image = encode_file_to_base64(data["input"], True)

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

            entrypoint = "sdapi/v1/img2img"

            # FLUX
            if "kontext" in data:
                print("[INFO] Режим Forge FluxKontext")
                reference = encode_file_to_base64(data["reference"], True) if "reference" in data else None
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
                reference = encode_file_to_base64(data["reference"], True) if "reference" in data else None
                payload["alwayson_scripts"] = {
                    "ImageStitch Integrated": {"args": [True, [reference]]}
                }
                entrypoint = "sdapi/v1/txt2img"

            enqueue_generation(entrypoint, payload, data["output"])

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

            enqueue_generation("sdapi/v1/extra-single-image", payload, data["output"])

        # TRANSLATE
        elif msg_type == "translate":
            print("[INFO] Запрос перевода")
            if check_module("deep_translator"):
                from deep_translator import GoogleTranslator
                try:
                    translated = GoogleTranslator(source="auto", target="english").translate(message["message"])
                except:
                    translated = ""
                send_data_to_jsx({"type": "answer", "message": translated})

        # UPDATE
        elif msg_type == "update":
            print("[INFO] Обновление настроек SD")
            data = message["message"]
            with urllib.request.urlopen(f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/options") as resp:
                options = json.load(resp)

            for key in data:
                if data[key] is not None:
                    options[key] = data[key]

            payload = json.dumps(options).encode("utf-8")
            req = urllib.request.Request(
                f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/options",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req) as resp:
                send_data_to_jsx({"type": "answer", "message": resp.read().decode()})

        # GET
        elif msg_type == "get":
            print("[INFO] Получение данных из SD")
            result = get_data_from_SD(message["message"])
            if result is not None:
                send_data_to_jsx(result)

    except Exception as e:
        print(f"[ERROR] Ошибка клиента: {e}")

    finally:
        client_socket.close()


# ==============================
# СЕРВЕР
# ==============================

def start_local_server():
    global worker_thread

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind((API_HOST, API_PORT_LISTEN))
    srv.listen()

    open(LOCK_PATH, "w").close()
    print("[INFO] Сервер запущен и готов к работе")

    threading.Thread(target=timeout_watcher, daemon=True).start()

    if worker_thread is None:
        worker_thread = threading.Thread(target=generation_worker, daemon=True)
        worker_thread.start()
        print("[INFO] Worker генерации запущен")

    while True:
        client_socket, addr = srv.accept()
        print(f"[INFO] Подключение от {addr}")
        threading.Thread(
            target=handle_client,
            args=(client_socket,),
            daemon=True
        ).start()


if __name__ == "__main__":
    start_local_server()