import { Clipboard, getPreferenceValues, showHUD, showToast, Toast } from "@raycast/api";
import { execSync } from "child_process";
import fs from "fs";
import FormData from "form-data";
import https from "https";

export default async function Command() {
  const preferences = getPreferenceValues();
  const apiKey = preferences.apiKey;
  const TEMP_FILE = "/tmp/raycast-ocr-temp.png";

  try {
    // 1. Capture screen selection
    execSync(`/usr/sbin/screencapture -i "${TEMP_FILE}"`);

    if (!fs.existsSync(TEMP_FILE) || fs.statSync(TEMP_FILE).size === 0) {
      await showToast({ style: Toast.Style.Failure, title: "No screenshot taken" });
      return;
    }

    // 2. Prepare OCR request
    const form = new FormData();
    form.append("file", fs.createReadStream(TEMP_FILE));
    form.append("apikey", apiKey);
    form.append("language", "cht"); // Traditional Chinese
    form.append("isOverlayRequired", "false");
    form.append("detectOrientation", "true");

    // 3. Process OCR
    const options = {
      method: "POST",
      headers: form.getHeaders(),
    };
    await new Promise<void>((resolve, reject) => {
      const req = https.request("https://api.ocr.space/parse/image", options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (data.ErrorMessage?.length > 0) {
              throw new Error(data.ErrorMessage.join(", "));
            }
            const text = data.ParsedResults[0].ParsedText.trim();
            Clipboard.copy(text).then(() => showHUD("✅ Text copied!"));
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      req.on("error", reject);
      form.pipe(req);
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "OCR Failed",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
  }
}
