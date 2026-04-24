from fastapi import fastapi

app = fastapi()

@app.get("/")
def home():
    return {
        "message": "Who'sHere backend is running!"
    }