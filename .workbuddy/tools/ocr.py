"""OCR tool for WorkBuddy - uses RapidOCR (onnxruntime)"""
import sys
from rapidocr_onnxruntime import RapidOCR

def main():
    if len(sys.argv) < 2:
        print("Usage: python ocr.py <image_path> [lang]", file=sys.stderr)
        sys.exit(1)
    img_path = sys.argv[1]
    ocr = RapidOCR()
    result, elapse = ocr(img_path)
    if not result:
        print("(no text detected)")
        return
    # result: list of [box, text, score]
    for item in result:
        print(item[1])

if __name__ == "__main__":
    main()
