# SPDX-License-Identifier: Apache-2.0
"""Run the iOS sample on a temporary simulator and export its actual receipt."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import time


def sim(*args, timeout=120):
    return subprocess.run(["xcrun", "simctl", *args], check=True, timeout=timeout,
                          text=True, stdout=subprocess.PIPE).stdout.strip()


def choose_simulator():
    installed = json.loads(sim("list", "devices", "available", "--json"))["devices"]
    runtimes = json.loads(sim("list", "runtimes", "--json"))["runtimes"]
    ios = [r for r in runtimes if r.get("isAvailable") and ".iOS-" in r["identifier"]]
    ios.sort(key=lambda r: tuple(int(n) for n in r["version"].split(".")), reverse=True)
    for runtime in ios:
        for phone in installed.get(runtime["identifier"], []):
            if phone.get("isAvailable") and "iPhone" in phone["name"] and phone.get("deviceTypeIdentifier"):
                return phone["deviceTypeIdentifier"], runtime["identifier"]
    raise RuntimeError("No installed iOS Simulator runtime with an available iPhone device type")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--id", default="org.egret.runtime.ios.sample")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    device, runtime = choose_simulator()
    udid = sim("create", "Egret Runtime Verification", device, runtime)
    try:
        sim("boot", udid)
        sim("bootstatus", udid, "-b", timeout=360)
        sim("install", udid, str(args.app.resolve()))
        sim("launch", udid, args.id, "--egret-verify")
        data = Path(sim("get_app_container", udid, args.id, "data"))
        report = data / "Documents" / "egret-ios-receipt.json"
        deadline = time.monotonic() + 90
        while not report.is_file() and time.monotonic() < deadline:
            time.sleep(1)
        if not report.is_file():
            raise RuntimeError("The installed app produced no verification receipt within 90 seconds")
        shutil.copyfile(report, args.out / "receipt.json")
        print(report.read_text(encoding="utf-8"))
    finally:
        sim("delete", udid)


if __name__ == "__main__":
    main()
