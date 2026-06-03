"""行程规划领域 - LLM 和搜索工具（延迟导入避免模块加载时依赖langchain）"""
from __future__ import annotations

from app.core.config import get_settings


def get_llm():
    """获取主力LLM实例"""
    from langchain_anthropic import ChatAnthropic
    settings = get_settings()
    kwargs: dict = {
        "model": settings.llm_model,
        "api_key": settings.anthropic_api_key,
        "max_tokens": 16384,
    }
    if settings.anthropic_base_url:
        kwargs["base_url"] = settings.anthropic_base_url
    return ChatAnthropic(**kwargs)


def get_llm_light():
    """获取轻量LLM实例（用于非核心任务）"""
    from langchain_anthropic import ChatAnthropic
    settings = get_settings()
    kwargs: dict = {
        "model": settings.llm_model_light,
        "api_key": settings.anthropic_api_key,
        "max_tokens": 4096,
    }
    if settings.anthropic_base_url:
        kwargs["base_url"] = settings.anthropic_base_url
    return ChatAnthropic(**kwargs)


def get_search_tool():
    """获取Tavily搜索客户端"""
    from tavily import TavilyClient
    settings = get_settings()
    return TavilyClient(api_key=settings.tavily_api_key)


async def search_single(search_client, query: str) -> list[str]:
    """执行单次搜索"""
    result = search_client.search(query, max_results=5, search_depth="advanced")
    return [
        f"[{r['title']}]({r['url']})\n{r['content'][:500]}"
        for r in result.get("results", [])
    ]
