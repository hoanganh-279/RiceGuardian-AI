#!/usr/bin/env python3
"""RiceGuardian-AI — MQTT test publisher.

Mô phỏng gateway LoRa = Raspberry Pi: publish dữ liệu cảm biến lên broker MQTT
để app (đang mở) có thể nhận và hiển thị.

Yêu cầu: pip install paho-mqtt

Cách dùng:
    python mqtt_publish_test.py --host 192.168.1.10
    python mqtt_publish_test.py --host localhost --port 1883 --nodes 3 --interval 5
"""

import argparse
import json
import random
import time

try:
    import paho.mqtt.client as mqtt
except ImportError:
    raise SystemExit("Thiếu thư viện paho-mqtt. Chạy: pip install paho-mqtt")


TOPIC_TEMPLATE = "riceguardian/station/{node_id}/reading"


def build_payload(node_id: int, seq: int) -> dict:
    return {
        "node_id": node_id,
        "seq": seq,
        "hop": random.randint(0, 4),
        "rssi": random.randint(-110, -60),
        "battery": round(random.uniform(3.4, 4.2), 2),
        "ts": int(time.time()),
        "temp": round(random.uniform(26.0, 34.0), 1),
        "humi": round(random.uniform(55.0, 90.0), 1),
        "water": round(random.uniform(2.0, 12.0), 1),
        "light": random.randint(150, 1200),
        "soil": round(random.uniform(25.0, 65.0), 1),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish test LoRa sensor data over MQTT")
    parser.add_argument("--host", default="localhost", help="Broker host / IP (vd. 192.168.1.10)")
    parser.add_argument("--port", type=int, default=1883, help="Broker port")
    parser.add_argument("--username", default="", help="Broker username (optional)")
    parser.add_argument("--password", default="", help="Broker password (optional)")
    parser.add_argument("--nodes", type=int, default=2, help="Số node giả lập")
    parser.add_argument("--interval", type=float, default=5.0, help="Giây giữa các lần gửi")
    parser.add_argument("--topic", default="", help="Ghi đè topic (cần placeholder {node_id}")
    args = parser.parse_args()

    client = mqtt.Client(client_id=f"rg-test-{random.randint(0, 9999)}")
    if args.username:
        client.username_pw_set(args.username, args.password)

    client.connect(args.host, args.port, keepalive=30)
    client.loop_start()

    seq = {node: 0 for node in range(1, args.nodes + 1)}
    print(f"Kết nối broker {args.host}:{args.port}, {args.nodes} node, mỗi {args.interval}s")

    try:
        while True:
            for node in range(1, args.nodes + 1):
                seq[node] += 1
                payload = build_payload(node, seq[node])
                topic = args.topic.format(node_id=node) if args.topic else TOPIC_TEMPLATE.format(node_id=node)
                client.publish(topic, json.dumps(payload), qos=0)
                print(f"[{time.strftime('%H:%M:%S')}] {topic} -> seq={seq[node]} temp={payload['temp']}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nĐã dừng.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()