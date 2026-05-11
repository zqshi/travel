export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const COUNTRY_OPTIONS = [
  { code: "TH", name: "泰国", flag: "\u{1F1F9}\u{1F1ED}", desc: "海岛/美食/寺庙" },
  { code: "JP", name: "日本", flag: "\u{1F1EF}\u{1F1F5}", desc: "樱花/温泉/动漫" },
  { code: "MY", name: "马来西亚", flag: "\u{1F1F2}\u{1F1FE}", desc: "双子塔/海岛/美食" },
  { code: "ID", name: "印度尼西亚", flag: "\u{1F1EE}\u{1F1E9}", desc: "巴厘岛/潜水" },
  { code: "VN", name: "越南", flag: "\u{1F1FB}\u{1F1F3}", desc: "河粉/下龙湾" },
  { code: "SG", name: "新加坡", flag: "\u{1F1F8}\u{1F1EC}", desc: "花园城市/环球影城" },
] as const;

export type CountryOption = (typeof COUNTRY_OPTIONS)[number];

export const COMPARE_PRESETS_MAP: Record<string, string[]> = {
  TH: ["曼谷大皇宫门票", "普吉岛浮潜一日游", "曼谷到清迈火车票", "曼谷四面佛附近酒店"],
  JP: ["东京迪士尼门票", "京都和服体验", "大阪环球影城门票", "东京到京都新干线"],
  MY: ["吉隆坡双子塔门票", "兰卡威跳岛游", "槟城美食半日游", "吉隆坡到槟城机票"],
  ID: ["巴厘岛水上乐园门票", "蓝梦岛浮潜一日游", "乌布漂流体验", "巴厘岛包车一日游"],
  VN: ["下龙湾一日游", "胡志明市古芝地道门票", "河内到下龙湾交通", "岘港巴拿山门票"],
  SG: ["环球影城门票", "滨海湾花园门票", "夜间动物园门票", "圣淘沙一日通票"],
};

export const PREF_MAP: Record<string, string> = {
  "海岛": "beach", "沙滩": "beach", "海滩": "beach",
  "文化": "culture", "历史": "culture", "寺庙": "culture",
  "美食": "food", "吃": "food", "餐饮": "food",
  "冒险": "adventure", "户外": "adventure", "运动": "adventure",
  "购物": "shopping", "买": "shopping",
  "夜生活": "nightlife", "酒吧": "nightlife",
  "自然": "nature", "风景": "nature",
  "放松": "relaxation", "休闲": "relaxation", "度假": "relaxation",
};
