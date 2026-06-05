import os
import sys
import traceback


def main():
    try:
        from main import app
    except Exception:
        print("Render startup failed while importing `main.py`.", file=sys.stderr)
        traceback.print_exc()
        raise

    try:
        import uvicorn
    except Exception:
        print("Render startup failed while importing `uvicorn`.", file=sys.stderr)
        traceback.print_exc()
        raise

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="debug")


if __name__ == "__main__":
    main()
