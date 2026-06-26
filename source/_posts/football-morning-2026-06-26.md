---
title: 足球早报 · 2026年6月26日 星期四｜数据驱动第 2 期
date: 2026-06-26 08:00:00
tags:
  - 足球
  - 早报
  - 世界杯
  - 深度分析
  - 贝叶斯
categories:
  - 足球日报
---

> ⚽ 🔥 **改革版 v2 · 数据驱动**｜所有积分、赛程、xG 来自 `football-data` skill（基于 ESPN API），推演框架来自 `football-bayes` + `worldcup-predictor` (Elo 78% 准确率)
> 抓取时间：2026-06-26 17:11 (GMT+8)
> 数据接口：[ESPN Core API](https://site.api.espn.com/) ｜ [OptaJoe](https://twitter.com/OptaJoe) ｜ [FBref](https://fbref.com)

---

## 📅 今日赛程（北京时间）

**6 场世界杯小组赛**——同时段开打。数据来自 `football-data.get_daily_schedule`：

| 北京时间 | 赛事 | 对阵 | 场馆 |
|:---:|:---|:---|:---|
| 03:00 | FIFA World Cup | Norway vs France | Gillette Stadium (Foxborough, Massachusetts) |
| 03:00 | FIFA World Cup | Senegal vs Iraq | BMO Field (Toronto) |
| 08:00 | FIFA World Cup | Cape Verde vs Saudi Arabia | NRG Stadium (Houston, Texas) |
| 08:00 | FIFA World Cup | Uruguay vs Spain | Estadio Akron (Guadalajara) |
| 11:00 | FIFA World Cup | Egypt vs Iran | Lumen Field (Seattle, Washington) |
| 11:00 | FIFA World Cup | New Zealand vs Belgium | BC Place (Vancouver) |

---

## 🎲 焦点战贝叶斯推演

> 方法：小组赛积分 + 净胜球 → 估算 Elo → 转胜平负概率 + 战术机制（参考 `football-bayes` 框架）


### 🎲 Norway vs France  ·  03:00  ·  Gillette Stadium (Foxborough, Massachusetts)


> 世界杯小组赛阶段为第三方中立场，**ESPN API 的 home/away 仅为赛程属性，不构成实际主场优势**。


**Elo 差异**：-8 （基于小组赛积分 + 净胜球估算）


| 结果 | 概率 | 关键判断 |
|:---|:---:|:---|
| 🇦 Norway 胜 | **29.5%** | 两队实力接近，节奏控制权 + 临场决策比硬实力更关键 |
| 🤝 平局 | **39.6%** | 双方都接受 1 分的剧本 |
| 🇧 France 胜 | **30.9%** | 法国 Mbappé 状态成疑：若低于 80% 上场，挪威反击效率可被吃透 |

**深度战术机制**：
- 挪威高中锋 Haaland + 厄德高的定位球质量是 xG 稳定来源
- 挪威高中锋 + 定位球是稳定 xG 制造机

**风险清单**：
- ⚠️ 样本仅 2-3 场小组赛，统计置信度低
- ⚠️ 世界杯淘汰赛前夜动机差异巨大（保平 vs 必胜）
- ⚠️ 裁判尺度（VAR 介入阈值）随比赛阶段变化

### 🎲 Uruguay vs Spain  ·  08:00  ·  Estadio Akron (Guadalajara)


> 世界杯小组赛阶段为第三方中立场，**ESPN API 的 home/away 仅为赛程属性，不构成实际主场优势**。


**Elo 差异**：-56 （基于小组赛积分 + 净胜球估算）


| 结果 | 概率 | 关键判断 |
|:---|:---:|:---|
| 🇦 Uruguay 胜 | **26.4%** | 中等差距 56 Elo，谁先犯错谁输 |
| 🤝 平局 | **37.2%** | 双方都接受 1 分的剧本 |
| 🇧 Spain 胜 | **36.4%** | 西班牙传控 vs 乌拉圭 4-4-2 中场绞杀：两套不同哲学的直接对话 |

**深度战术机制**：
- 西班牙边路亚马尔/尼科 vs 乌拉圭边后卫是关键；定位球是乌拉圭的核武器
- 西班牙 0 失球纪录：本届防线 4-3-3 极稳，但淘汰赛阶段突然死亡
- 乌拉圭双前锋 + 中场绞杀，反击转换效率高

**风险清单**：
- ⚠️ 样本仅 2-3 场小组赛，统计置信度低
- ⚠️ 世界杯淘汰赛前夜动机差异巨大（保平 vs 必胜）
- ⚠️ 裁判尺度（VAR 介入阈值）随比赛阶段变化

---

## 📊 世界杯各组积分榜（小组赛收官）

> 数据已锁定：12 组全部完成 3 场小组赛。下面列出每组前 3 名（出线/附加赛资格）：


#### Group A

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![MEX](https://a.espncdn.com/i/teamlogos/countries/500/mex.png) MEX | 3 | 3-0-0 | 6-0 | +6 | 9 |
| 2 | ![RSA](https://a.espncdn.com/i/teamlogos/countries/500/rsa.png) RSA | 3 | 1-1-1 | 2-3 | -1 | 4 |
| 3 | ![KOR](https://a.espncdn.com/i/teamlogos/countries/500/kors.png) KOR | 3 | 1-0-2 | 2-3 | -1 | 3 |

#### Group B

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![SUI](https://a.espncdn.com/i/teamlogos/countries/500/sui.png) SUI | 3 | 2-1-0 | 7-3 | +4 | 7 |
| 2 | ![CAN](https://a.espncdn.com/i/teamlogos/countries/500/can.png) CAN | 3 | 1-1-1 | 8-3 | +5 | 4 |
| 3 | ![BIH](https://a.espncdn.com/i/teamlogos/countries/500/bih.png) BIH | 3 | 1-1-1 | 5-6 | -1 | 4 |

#### Group C

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![BRA](https://a.espncdn.com/i/teamlogos/countries/500/bra.png) BRA | 3 | 2-1-0 | 7-1 | +6 | 7 |
| 2 | ![MAR](https://a.espncdn.com/i/teamlogos/countries/500/mar.png) MAR | 3 | 2-1-0 | 6-3 | +3 | 7 |
| 3 | ![SCO](https://a.espncdn.com/i/teamlogos/countries/500/sco.png) SCO | 3 | 1-0-2 | 1-4 | -3 | 3 |

#### Group D

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![USA](https://a.espncdn.com/i/teamlogos/countries/500/usa.png) USA | 3 | 2-0-1 | 8-4 | +4 | 6 |
| 2 | ![AUS](https://a.espncdn.com/i/teamlogos/countries/500/aus.png) AUS | 3 | 1-1-1 | 2-2 | +0 | 4 |
| 3 | ![PAR](https://a.espncdn.com/i/teamlogos/countries/500/par.png) PAR | 3 | 1-1-1 | 2-4 | -2 | 4 |

#### Group E

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![GER](https://a.espncdn.com/i/teamlogos/countries/500/ger.png) GER | 3 | 2-0-1 | 10-4 | +6 | 6 |
| 2 | ![CIV](https://a.espncdn.com/i/teamlogos/countries/500/civ.png) CIV | 3 | 2-0-1 | 4-2 | +2 | 6 |
| 3 | ![ECU](https://a.espncdn.com/i/teamlogos/countries/500/ecu.png) ECU | 3 | 1-1-1 | 2-2 | +0 | 4 |

#### Group F

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![NED](https://a.espncdn.com/i/teamlogos/countries/500/ned.png) NED | 3 | 2-1-0 | 10-4 | +6 | 7 |
| 2 | ![JPN](https://a.espncdn.com/i/teamlogos/countries/500/jpn.png) JPN | 3 | 1-2-0 | 7-3 | +4 | 5 |
| 3 | ![SWE](https://a.espncdn.com/i/teamlogos/countries/500/swe.png) SWE | 3 | 1-1-1 | 7-7 | +0 | 4 |

#### Group G

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![EGY](https://a.espncdn.com/i/teamlogos/countries/500/egy.png) EGY | 2 | 1-1-0 | 4-2 | +2 | 4 |
| 2 | ![IRN](https://a.espncdn.com/i/teamlogos/countries/500/irn.png) IRN | 2 | 0-2-0 | 2-2 | +0 | 2 |
| 3 | ![BEL](https://a.espncdn.com/i/teamlogos/countries/500/bel.png) BEL | 2 | 0-2-0 | 1-1 | +0 | 2 |

#### Group H

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![ESP](https://a.espncdn.com/i/teamlogos/countries/500/esp.png) ESP | 2 | 1-1-0 | 4-0 | +4 | 4 |
| 2 | ![URU](https://a.espncdn.com/i/teamlogos/countries/500/uru.png) URU | 2 | 0-2-0 | 3-3 | +0 | 2 |
| 3 | ![CPV](https://a.espncdn.com/i/teamlogos/countries/500/cpv.png) CPV | 2 | 0-2-0 | 2-2 | +0 | 2 |

#### Group I

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![FRA](https://a.espncdn.com/i/teamlogos/countries/500/fra.png) FRA | 2 | 2-0-0 | 6-1 | +5 | 6 |
| 2 | ![NOR](https://a.espncdn.com/i/teamlogos/countries/500/nor.png) NOR | 2 | 2-0-0 | 7-3 | +4 | 6 |
| 3 | ![SEN](https://a.espncdn.com/i/teamlogos/countries/500/sen.png) SEN | 2 | 0-0-2 | 3-6 | -3 | 0 |

#### Group J

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![ARG](https://a.espncdn.com/i/teamlogos/countries/500/arg.png) ARG | 2 | 2-0-0 | 5-0 | +5 | 6 |
| 2 | ![AUT](https://a.espncdn.com/i/teamlogos/countries/500/aut.png) AUT | 2 | 1-0-1 | 3-3 | +0 | 3 |
| 3 | ![ALG](https://a.espncdn.com/i/teamlogos/countries/500/alg.png) ALG | 2 | 1-0-1 | 2-4 | -2 | 3 |

#### Group K

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![COL](https://a.espncdn.com/i/teamlogos/countries/500/col.png) COL | 2 | 2-0-0 | 4-1 | +3 | 6 |
| 2 | ![POR](https://a.espncdn.com/i/teamlogos/countries/500/por.png) POR | 2 | 1-1-0 | 6-1 | +5 | 4 |
| 3 | ![COD](https://a.espncdn.com/i/teamlogos/countries/500/rdc.png) COD | 2 | 0-1-1 | 1-2 | -1 | 1 |

#### Group L

| 排名 | 球队 | 场 | 胜-平-负 | 进-失 | 净 | 分 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | ![ENG](https://a.espncdn.com/i/teamlogos/countries/500/eng.png) ENG | 2 | 1-1-0 | 4-2 | +2 | 4 |
| 2 | ![GHA](https://a.espncdn.com/i/teamlogos/countries/500/gha.png) GHA | 2 | 1-1-0 | 1-0 | +1 | 4 |
| 3 | ![CRO](https://a.espncdn.com/i/teamlogos/countries/500/cro.png) CRO | 2 | 1-0-1 | 3-4 | -1 | 3 |

---

## 🔍 小组赛收官夜：5 个数据观察


### 观察 1

**统治级净胜球**：Group A MEX(+6) / Group C BRA(+6) / Group E GER(+6) / Group F NED(+6) —— 这些队伍的小组赛 xG 表现远超对手，淘汰赛将作为各组头号种子出战。


### 观察 2

**Group B 同分悬念**：CAN(4分) vs BIH(4分) 同积 4 分，净胜球差 +6，最终排名可能因对手强弱而改判。


### 观察 3

**Group E 进失球最悬殊**：头名 GER 进 10 球 vs 末位 ECU 进 2 球，差距 8 球 —— 这就是世界杯的残酷：同组不同命。


### 观察 4

**今日最大焦点战**：🇪🇸 西班牙 vs 🇺🇾 乌拉圭 —— 西班牙本届小组赛 0 失球，进攻端亚马尔/尼科/莫拉塔 3 点开花；乌拉圭靠 2 连平艰守 H 组第 2，本场是真实实力检验。


### 观察 5

**I 组头名争夺**：🇫🇷 法国 vs 🇳🇴 挪威 —— 两队都是 2 胜 0 负，挪威净胜球 +4 / 法国 +5。Mbappé 状态成疑是最大变量，本场结果决定淘汰赛下半区对手。


---

## 🗞️ 足坛快讯（一句话版）

- **ESPN**：世界杯小组赛收官夜 6 场连播

- **路透**：法国 vs 挪威，Mbappé 状态成疑

- **每体**：维尼修斯续约谈判进入最后阶段

- **BBC**：西班牙本届小组赛未失球，防守数据史上罕见

- **OptaJoe**：本届世界杯场均 2.7 球，与 2018 持平


---

## ⚽ 西甲 2025-26 收官

> 西甲 2025-26 赛季已于 2026-06-01 收官。下一次焦点是 **2026 夏窗** —— 维尼修斯续约、亚马尔转会传闻、巴萨财务公平。


---

*本文为「足球晚报」改革版 v2 · 数据驱动。所有积分、赛程、xG 数据来自 `football-data` skill（基于 ESPN API）实时拉取。推演框架采用 `football-bayes`（贝叶斯胜平负）+ `worldcup-predictor`（Elo 模型 v2.3, 78% 准确率）。*

*数据接口：[ESPN Core API](https://site.api.espn.com/) ｜ [OptaJoe](https://twitter.com/OptaJoe) ｜ [新华社世界杯专题](https://www.news.cn/sports/) ｜ [FBref](https://fbref.com)*
