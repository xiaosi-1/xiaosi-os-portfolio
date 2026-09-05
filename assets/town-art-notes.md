# 小四小镇 · 精细美术 V2

由内置 image_gen 工具为本项目生成的原创素材，未使用《星露谷物语》的游戏资产。

## 素材与最终提示词方向

所有素材均为 1536 × 1024。共同提示词：Original cozy RPG fine pixel illustration; warm upper-left afternoon light; tiny intentional pixel clusters; clean readable silhouettes; muted sage, honey timber and cream palette; no coarse block shapes, no noise, no UI, no watermark.

| 文件 | 提示词与构图约束 |
| --- | --- |
| town-scenery-v2.png | 3 × 2 sprite atlas. Top row: terracotta-roof artist cottage, blue-slate cinema cottage, burgundy-roof library cottage. Bottom row: oak, apple tree, tall leafy tree. Front-facing elevated RPG perspective; centered doors; carved wood, ivy and flower boxes; isolated sprites with generous gutters. |
| town-actors-v2.png | 4 × 2 sprite atlas on pure white. Four directional views of the same black-haired young adventurer, denim jacket, cream shirt, brown satchel and boots. Bottom row: orange tabby cat, acorn woodland guardian, lavender crystal guardian, mossy stone wishing well. |
| town-room-v2.png | Empty orthographic cottage interior. Top 24 percent plaster wall, timber beams and two sage-curtain windows; honey oak floor below; central dusty-green woven rug and bottom-center doorway. No characters, furniture, finished artworks or text. |
| town-meadow-v2.png | Continuous orthographic meadow ground layer. Muted sage/olive greens, restrained short grass tufts and subtle clover patches; broad quiet tonal variations; no objects, paths, trees, water, grid, horizon or high-contrast noise. |
| town-props-v2.png | 3 × 2 isolated prop atlas on white. Top row: ornate display easel with cream placeholder paper, brass/teal vintage projector on oak table, wood bookcase. Bottom row: brass-bound treasure chest, corked message bottle, flower pot on low wood stand. |

原始生成 PNG 保留在此目录；精灵底色在 Canvas 加载时按边缘连通区域处理，图片文件本身不会被改写。地图、碰撞、遮挡顺序、角色动作、水波、提示与内容入口仍由程序控制，并非整图热点替代游戏。

## 绘制与降级

- 场景和角色图集在首次打开小镇时加载，同一页面复用。
- 高清屏使用最高 2 倍 Canvas backing store；镜头始终使用逻辑尺寸。
- 素材未加载完时使用基础画面；加载失败提示用户，游戏可继续。
- 室内 `(2, 7)`、`(12, 7)` 花盆桌与既有碰撞对应。
- 素材全部随项目发布，无外部图片服务依赖。
