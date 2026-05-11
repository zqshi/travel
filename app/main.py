from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.auth import router as auth_router
from app.api.sessions import router as sessions_router
from app.api.booking import router as booking_router
from app.api.voice_booking import router as voice_booking_router
from app.api.websocket import router as ws_router
from app.api.chat import router as chat_router
from app.services.order_monitor import start_order_monitor, stop_order_monitor


@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_order_monitor()
    yield
    await stop_order_monitor()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Travel Agent API",
        description="AI旅游Agent - 跨语言跨平台旅游预定自动化",
        version="0.2.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(sessions_router)
    app.include_router(booking_router)
    app.include_router(voice_booking_router)
    app.include_router(ws_router)
    app.include_router(chat_router)
    return app


app = create_app()
