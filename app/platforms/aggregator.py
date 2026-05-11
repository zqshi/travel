from __future__ import annotations

from dataclasses import dataclass
from abc import ABC, abstractmethod

import httpx


@dataclass
class PlatformItem:
    name: str
    price_thb: float
    price_cny: float
    url: str
    platform: str
    category: str
    available: bool = True
    rating: float | None = None
    notes: str = ""


class BasePlatform(ABC):
    @abstractmethod
    async def search(self, query: str, category: str = "") -> list[PlatformItem]:
        ...


class KlookPlatform(BasePlatform):
    """Klook affiliate搜索（POC阶段用网页检索模拟）"""

    BASE_URL = "https://www.klook.com"

    def __init__(self, affiliate_id: str = ""):
        self.affiliate_id = affiliate_id

    async def search(self, query: str, category: str = "") -> list[PlatformItem]:
        # POC阶段：通过Tavily检索Klook页面获取信息
        # 正式阶段：接入Klook affiliate API
        from app.core.config import get_settings
        from tavily import TavilyClient

        settings = get_settings()
        client = TavilyClient(api_key=settings.tavily_api_key)

        try:
            result = client.search(
                f"site:klook.com {query} Thailand",
                max_results=5,
                search_depth="advanced",
            )
            items = []
            for r in result.get("results", []):
                items.append(PlatformItem(
                    name=r["title"],
                    price_thb=0,
                    price_cny=0,
                    url=r["url"],
                    platform="Klook",
                    category=category or "activity",
                    notes=r["content"][:200],
                ))
            return items
        except Exception:
            return []


class KKdayPlatform(BasePlatform):
    """KKday affiliate搜索"""

    async def search(self, query: str, category: str = "") -> list[PlatformItem]:
        from app.core.config import get_settings
        from tavily import TavilyClient

        settings = get_settings()
        client = TavilyClient(api_key=settings.tavily_api_key)

        try:
            result = client.search(
                f"site:kkday.com {query} Thailand",
                max_results=5,
                search_depth="advanced",
            )
            items = []
            for r in result.get("results", []):
                items.append(PlatformItem(
                    name=r["title"],
                    price_thb=0,
                    price_cny=0,
                    url=r["url"],
                    platform="KKday",
                    category=category or "activity",
                    notes=r["content"][:200],
                ))
            return items
        except Exception:
            return []


class AgodaPlatform(BasePlatform):
    """Agoda住宿搜索"""

    async def search(self, query: str, category: str = "") -> list[PlatformItem]:
        from app.core.config import get_settings
        from tavily import TavilyClient

        settings = get_settings()
        client = TavilyClient(api_key=settings.tavily_api_key)

        try:
            result = client.search(
                f"site:agoda.com {query} Thailand hotel",
                max_results=5,
                search_depth="advanced",
            )
            items = []
            for r in result.get("results", []):
                items.append(PlatformItem(
                    name=r["title"],
                    price_thb=0,
                    price_cny=0,
                    url=r["url"],
                    platform="Agoda",
                    category="hotel",
                    notes=r["content"][:200],
                ))
            return items
        except Exception:
            return []


class TwelveGoPlatform(BasePlatform):
    """12Go.asia 交通票务搜索"""

    async def search(self, query: str, category: str = "") -> list[PlatformItem]:
        from app.core.config import get_settings
        from tavily import TavilyClient

        settings = get_settings()
        client = TavilyClient(api_key=settings.tavily_api_key)

        try:
            result = client.search(
                f"site:12go.asia {query} Thailand",
                max_results=5,
                search_depth="advanced",
            )
            items = []
            for r in result.get("results", []):
                items.append(PlatformItem(
                    name=r["title"],
                    price_thb=0,
                    price_cny=0,
                    url=r["url"],
                    platform="12Go",
                    category="transport",
                    notes=r["content"][:200],
                ))
            return items
        except Exception:
            return []


async def search_all_platforms(query: str, category: str = "") -> list[PlatformItem]:
    """并发搜索所有平台"""
    import asyncio

    platforms: list[BasePlatform] = [
        KlookPlatform(),
        KKdayPlatform(),
        AgodaPlatform(),
        TwelveGoPlatform(),
    ]

    tasks = [p.search(query, category) for p in platforms]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_items = []
    for result in results:
        if isinstance(result, list):
            all_items.extend(result)
    return all_items
