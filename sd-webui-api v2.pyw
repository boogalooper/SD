import socket
import json
import urllib.request
import sys
import time
import base64
from datetime import datetime
import os

LOCALHOST = "127.0.0.1"
SD_PORT = 7860
API_PORT_SEND = 6321
API_PORT_LISTEN = 6320


def get_data_from_SD(api_name):
    try:
        url = f"http://{LOCALHOST}:{SD_PORT}/{api_name}"
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
            s.connect((LOCALHOST, API_PORT_SEND))
            s.sendall(json.dumps(message).encode("utf-8"))
    except Exception as e:
        print(f"Ошибка при отправке данных: {e}")


def timestamp():
    return datetime.fromtimestamp(time.time()).strftime("%Y%m%d-%H%M%S")


def encode_file_to_base64(path):
    with open(path, "rb") as file:
        f = base64.b64encode(file.read()).decode("utf-8")
    os.remove(path)
    return f


def decode_and_save_base64(base64_str, save_path):
    with open(save_path, "wb") as file:
        file.write(base64.b64decode(base64_str))


def call_api(api_endpoint, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"http://{LOCALHOST}:{SD_PORT}/{api_endpoint}",
        headers={"Content-Type": "application/json"},
        data=data,
    )
    response = urllib.request.urlopen(request)
    return json.loads(response.read().decode("utf-8"))


def call_img2img_api(payload, out_dir):
    response = call_api("sdapi/v1/img2img", payload)
    for index, image in enumerate(response.get("images")):
        save_path = os.path.join(out_dir, f"{timestamp()}-{index}.png")
        decode_and_save_base64(image, save_path)
    return save_path


def start_local_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind((LOCALHOST, API_PORT_LISTEN))
    srv.listen(1)

    print("Сервер запущен и ожидает подключения...")

    while True:
        client_socket, client_address = srv.accept()
        print(f"Подключение установлено с {client_address}")
        try:
            message = client_socket.recv(1024)
            if message:
                message = json.loads(message.decode("utf-8").rstrip("\n"))
                print(f"Получено сообщение: {message}")
                if message["type"] == "get":
                    print(f"Получаем данные: {message['message']}")
                    result = get_data_from_SD(message["message"])
                    if result != None:
                        print(f"Отправляем данные: {message['message']}")
                        send_data_to_jsx(result)
                elif message["type"] == "update":
                    data = message["message"]
                    print(f"Запрос на обновление: {data}")
                    with urllib.request.urlopen(
                        f"http://{LOCALHOST}:{SD_PORT}/sdapi/v1/options"
                    ) as response:
                        options = json.load(response)
                        if data["sd_model_checkpoint"]:
                            options["sd_model_checkpoint"] = data["sd_model_checkpoint"]
                        if data["sd_vae"]:
                            options["sd_vae"] = data["sd_vae"]
                        payload = json.dumps(options).encode("utf-8")
                        req = urllib.request.Request(
                            f"http://{LOCALHOST}:{SD_PORT}/sdapi/v1/options",
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
                    init_images = [encode_file_to_base64(data["input"])]
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
                        "init_images": init_images,
                    }
                    outfile = call_img2img_api(payload, data["output"])
                    print("Генерация завершена!")
                    send_data_to_jsx({"type": "answer", "message": outfile})
                elif message["type"] == "exit":
                    sys.exit()
        except Exception as e:
            print(f"Произошла ошибка: {e}")
            # sys.exit()
        finally:
            client_socket.close()


start_local_server()
