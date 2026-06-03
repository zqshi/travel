"""应用入口 — 使用 DDD 领域路由"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _try_import_router(module_path: str, attr: str = "router"):
    """安全导入路由，缺少依赖时跳过"""
    try:
        import importlib
        mod = importlib.import_module(module_path)
        return getattr(mod, attr)
    except (ImportError, AttributeError) as e:
        logger.warning(f"跳过路由 {module_path}: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.services.order_monitor import start_order_monitor, stop_order_monitor
        await start_order_monitor()
        yield
        await stop_order_monitor()
    except ImportError:
        yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Travel Agent API",
        description="AI旅游Agent - 跨语言跨平台旅游预定自动化",
        version="0.3.0",
        lifespan=lifespan,
    )

    # CORS — 从环境变量读取
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 全局异常处理
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "服务内部错误，请稍后重试"},
        )

    # 注册领域路由（安全导入，缺依赖时跳过）
    routers = [
        "app.domains.planning.api",
        "app.domains.chat.api",
        "app.domains.booking.api",
        "app.domains.auth.api",
        "app.api.sessions",
        "app.api.voice_booking",
        "app.api.websocket",
    ]
    for module_path in routers:
        r = _try_import_router(module_path)
        if r:
            app.include_router(r)

    return app


app = create_app()
