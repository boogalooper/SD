import socket
import json
import urllib.request
import sys
import time
import base64
from datetime import datetime
import subprocess
import os

API_HOST = "127.0.0.1"
API_PORT_SEND = 6321
API_PORT_LISTEN = 6320


def get_data_from_SD(api_name, SD_HOST, SD_PORT):
    url = f"http://{SD_HOST}:{SD_PORT}/{api_name}"
    print(f"{url}")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = response.read().decode("utf-8")
            checkpoints = json.loads(data)
            return checkpoints
    except Exception as e:
        print(f"Ошибка при получении данных: {e}")
        return None


def send_data_to_jsx(message):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((API_HOST, API_PORT_SEND))
            s.sendall(json.dumps(message).encode("utf-8"))
    except Exception as e:
        print(f"Ошибка при отправке данных: {e}")


def timestamp():
    return datetime.fromtimestamp(time.time()).strftime("%Y%m%d-%H%M%S")


def encode_file_to_base64(path):
    with open(path, "rb") as file:
        encoded_data = base64.b64encode(file.read()).decode("utf-8")
    os.remove(path)
    return encoded_data


def decode_and_save_base64(base64_str, save_path):
    with open(save_path, "wb") as file:
        file.write(base64.b64decode(base64_str))


def call_generate_api(api_endpoint, payload, SD_HOST, SD_PORT, out_dir):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"http://{SD_HOST}:{SD_PORT}/{api_endpoint}",
        headers={"Content-Type": "application/json"},
        data=data,
    )
    response = urllib.request.urlopen(request)

    result = json.loads(response.read().decode("utf-8"))
    if "images" in result:
        for index, image in enumerate(result.get("images")):
            save_path = os.path.join(out_dir, f"{timestamp()}-{index}.png")
            decode_and_save_base64(image, save_path)
    elif "image" in result:
        save_path = os.path.join(out_dir, f"{timestamp()}.png")
        decode_and_save_base64(result.get("image"), save_path)
    else:
        return None
    return save_path


def check_module(module_name):
    try:
        __import__(module_name)
    except ImportError:
        print(f"Модуль {module_name} не найден. Устанавливаем...")
        return install_module(module_name)
    else:
        print(f"Модуль {module_name} уже установлен.")
        return True


def install_module(module_name):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", module_name])
        print(f"Модуль {module_name} успешно установлен.")
        return True
    except subprocess.CalledProcessError:
        print(f"Ошибка при установке модуля {module_name}.")
        return False


def start_local_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind((API_HOST, API_PORT_LISTEN))
    srv.listen(1)
    SD_HOST = None
    SD_PORT = None
    print("Сервер запущен и ожидает подключения...")

    while True:
        client_socket, client_address = srv.accept()
        print(f"Подключение установлено с {client_address}")
        try:
            message = client_socket.recv(4096)
            if message:
                message = json.loads(message.decode("utf-8").rstrip("\n"))
                print(f"Получено сообщение: {message}")
                if message["type"] == "get":
                    print(f"Получаем данные: {message['message']}")
                    result = get_data_from_SD(message["message"], SD_HOST, SD_PORT)
                    if result != None:
                        print(f"Отправляем данные: {message['message']}")
                        send_data_to_jsx(result)
                elif message["type"] == "handshake":
                    data = message["message"]
                    SD_HOST = data["sdHost"]
                    SD_PORT = int(data["sdPort"])
                    send_data_to_jsx({"type": "answer", "message": "success"})
                elif message["type"] == "update":
                    data = message["message"]
                    print(f"Запрос на обновление: {data}")
                    with urllib.request.urlopen(
                        f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/options"
                    ) as response:
                        options = json.load(response)
                        if "sd_model_checkpoint" in data and data["sd_model_checkpoint"]!=None:
                            options["sd_model_checkpoint"] = data["sd_model_checkpoint"]
                        if "sd_vae" in data and data["sd_vae"]!=None:
                            options["sd_vae"] = data["sd_vae"]
                        if "forge_additional_modules" in data and data["forge_additional_modules"]!=None:
                            options["forge_additional_modules"] = data["forge_additional_modules"]
                        if "forge_inference_memory" in data and data["forge_inference_memory"]!=None:
                            options["forge_inference_memory"] = int(data["forge_inference_memory"])
                        payload = json.dumps(options).encode("utf-8")
                        req = urllib.request.Request(
                            f"http://{SD_HOST}:{SD_PORT}/sdapi/v1/options",
                            data=payload,
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        with urllib.request.urlopen(req) as response:
                            response_data = response.read()
                            send_data_to_jsx(
                                {"type": "answer", "message": str(response_data)}
                            )
                        print("Обновление настроек успешно завершено!")
                elif message["type"] == "payload":
                    print("Получен запрос на генерацию изображения")
                    data = message["message"]
                    init_image = [encode_file_to_base64(data["input"])]
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
                        "init_images": init_image,
                    }
                    if "mask" in data:
                        payload["mask"] = encode_file_to_base64(data["mask"])
                        payload["inpainting_fill"] = data["inpainting_fill"]
                        payload["image_cfg_scale"] = 1.5
                        payload["inpaint_full_res"] = 0
                        payload["initial_noise_multiplier"] = 1
                        payload["resize_mode"] = 2
                    outfile = call_generate_api(
                        "sdapi/v1/img2img", payload, SD_HOST, SD_PORT, data["output"]
                    )
                    print("Генерация завершена!")
                    send_data_to_jsx({"type": "answer", "message": outfile})
                elif message["type"] == "faceRestore":
                    print("Получен запрос на воссстановление лица")
                    data = message["message"]
                    init_image = encode_file_to_base64(data["input"])
                    payload = {"image": init_image}
                    if data["gfpgan"] == "true":
                        payload["gfpgan_visibility"] = data["gfpgan_visibility"]
                    if data["codeformer"] == "true":
                        payload["codeformer_visibility"] = data["codeformer_visibility"]
                        payload["codeformer_weight"] = data["codeformer_weight"]
                    outfile = call_generate_api(
                        "sdapi/v1/extra-single-image",
                        payload,
                        SD_HOST,
                        SD_PORT,
                        data["output"],
                    )
                    print("Генерация завершена!")
                    send_data_to_jsx({"type": "answer", "message": outfile})
                elif message["type"] == "translate":
                    print("Получен запрос на перевод текста")
                    if check_module("deep_translator"):
                        from deep_translator import GoogleTranslator

                        try:
                            translated_text = GoogleTranslator(
                                source="auto", target="english"
                            ).translate(message["message"])
                            print("\nПереведённый текст на английском языке:")
                            print(translated_text)
                        except:
                            translated_text = ""
                    send_data_to_jsx(
                        {"type": "answer", "message": str(translated_text)}
                    )
                elif message["type"] == "exit":
                    sys.exit()
        except Exception as e:
            print(f"Произошла ошибка: {e}")
            send_data_to_jsx({"type": "answer", "message": None})
            sys.exit()
        finally:
            client_socket.close()


start_local_server()
