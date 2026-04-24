from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {
        "message": "Who'sHere backend is running!"
    }