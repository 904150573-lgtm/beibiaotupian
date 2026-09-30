# 背标图片批量生成

为 **Mac + Photoshop** 准备的最小项目：读取 Excel，每个可见工作表对应一个产品或口味，生成自包含 JSX，在 Photoshop 批量输出 JPG、可编辑 PSD 和运行报告。

## 快速开始

1. 安装 Python 3.10 或更新版本，安装 Mac Photoshop。
2. 将此前已适配的 **参数模版(3).psd** 复制到桌面，命名为 **背标模版.psd**。该版本为 1080 × 1679，文件大小 1,453,937 字节。仓库不包含你的实际 PSD 或品牌字体。
3. 安装模板使用的 `BlueSkyNoto-Regular` 和 `BlueSkyNoto-Bold` 字体。缺字体时脚本停止，不替换字体。
4. 在终端执行：

```bash
git clone https://github.com/904150573-lgtm/beibiaotupian.git
cd beibiaotupian
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python examples/make_example.py
python scripts/build_job.py examples/products.xlsx dist/背标出图.jsx
```

5. 打开 Photoshop，通过 **文件 → 脚本 → 浏览** 选择 `dist/背标出图.jsx`。不要运行 `photoshop_engine.jsx` 或 `preserve_type.jsx`。
6. 桌面生成独立的 `背标输出_<时间戳>` 文件夹，按工作表顺序导出每款产品。打开 `运行报告.txt` 确认是否成功。

示例数据均为虚构，仅演示输入结构。首次运行请核对实际 JPG 的全部文字、营养表、换行与字距。

## 下一次更换产品

将新产品按下面的格式写入 Excel，复制工作表添加其他口味，再生成新任务：

```bash
python scripts/build_job.py "/你的路径/新品.xlsx" "dist/新品背标.jsx" --config config/config.json
```

生成后可以在 `dist/新品背标.job.json` 中检查读取的数据，随后在 Photoshop 运行新的 JSX。生成的 JSX 内含全部数据与代码，不依赖旁边的 Python、JSON 文件，也不依赖 `LABEL_JOB` 全局变量。

## Excel 输入约定

| 列 | 内容 | 例子 |
| --- | --- | --- |
| A | 字段名或营养项目名 | 产品名称、能量 |
| C | 原文或营养数值 | 示例脆脆虾（原味）、2000 |
| D | 营养单位 | 千焦、克、毫克 |
| F | NRV 比例，使用百分比格式 | 数值 0.24，格式 `0%`，显示 24% |

每个可见工作表代表一个产品；隐藏工作表不处理。字段顺序可以变化；重复字段、未知字段与缺失必填项会报错。可调整列位置，见 `config/config.json`。

**产品字段：** 产品名称、配料、产品类别、生产日期、保质期、贮存方法、食用方法、温馨提示、致敏物提示、净含量。产品类别与温馨提示可为空，其余必填。类别为空时隐藏对应行并记入报告，不沿用旧模板内容。

**营养表：** 用“项目”行的 C 列指定 `每100克` 或 `每100g`。支持且要求完整提供能量、蛋白质、脂肪、—饱和脂肪、碳水化合物、—糖、钠。名称中的破折号使用 `—`。能量单位为千焦，钠为毫克，其余为克。糖 NRV 可以为空，其他 NRV 必填。

文本保留原文，不补空格、不改写配料或致敏信息。数值支持 `General`、`0`、`0.0`、`0.00` 等格式，保留显示精度；百分比支持 `0%`、`0.0%` 等，按四舍五入显示。日期支持文本或 `yyyy-mm-dd`、`yyyy/mm/dd`、`yyyy年mm月dd日`。其他显示格式拒绝处理。

仅计算 `=C14/8400` 这种“本工作表单元格除以非零常数”的营养公式。其他公式请先在 Excel 中转成值。不会将公式缓存当作重新计算的结果。

## 字距与排版

`preserve_type.jsx` 读取模板的字符、段落及手动 kerning 样式，按照原模板的**行号和字符位置**映射到新文字。超出原行长度的字符继承该行末字符样式；新增行继承模板最后一行。保留 tracking、手动 kerning、自动字偶距模式、字号、横纵缩放、leading 和段落对齐，不统一整层字距、不用空格撑宽。

每次换行量测都从原样式快照重建；写入后读回核验关键样式。宽度或总高度溢出时停止该产品，不缩小字号、不截断内容。上方字段按内容高度向下排列，字段间距由 `row_gap` 控制；它与文字层内部的 leading 是两个不同参数。文字长度改变会改变总行宽，无法要求字距和总行宽同时固定。

## 配置与模板适配

`config/config.json` 包含模板路径/尺寸/字体、Excel 列、字段图层 ID、文字区域、营养表布局与 JPG 质量。`config/template-map.json` 记录已适配模板的原始文字及 ID；引擎在修改前验证，避免替换错误图层。

当前映射只适用于上述 **参数模版(3).psd**。新模板在 Photoshop 打开后，可运行 `scripts/inspect_template.jsx` 导出文字图层清单，再人工核对 ID、配置与布局。详见 [模板适配与验收](docs/template-and-validation.md)。同尺寸的新 PSD 也不能直接沿用旧映射。文件大小检查只是辅助检查，不是文件内容校验。

## 文件结构

```text
beibiaotupian/
├── README.md
├── requirements.txt
├── config/
│   ├── config.json
│   └── template-map.json
├── scripts/
│   ├── build_job.py
│   ├── photoshop_engine.jsx
│   ├── preserve_type.jsx
│   └── inspect_template.jsx
├── examples/
│   ├── make_example.py
│   ├── products.xlsx
│   ├── expected-products.json
│   └── output-example.md
├── docs/template-and-validation.md
├── tests/
│   ├── test_build_job.py
│   └── test_type_ranges.js
└── .github/workflows/test.yml
```

`examples/products.xlsx` 由示例程序生成；`dist/*.jsx`、`dist/*.job.json` 是生成的任务文件；实际 JPG/PSD 在本机运行 Photoshop 后生成。

## 验证范围

```bash
python -m unittest discover -s tests -v
node tests/test_type_ranges.js
```

自动检查覆盖多口味读取、显示精度、百分比四舍五入、糖 NRV 空白、缺失类别、未知字段、营养单位、公式与 JSX 内嵌数据，以及纯逻辑的逐行样式范围映射、混合 tracking 和手动 kerning。GitHub Actions 额外做 JavaScript 语法检查，不能运行 Photoshop。

仓库实现的 Python 数据读取及 JSX 生成可在云端验证；Photoshop 的 Action Manager、字体渲染、实际换行和 JPG 输出需在 Mac 上验收。没有后台监听器，也没有聊天上传到 Mac 的自动传输连接。

参考：[Adobe Photoshop 脚本入口](https://developer.adobe.com/photoshop/)、[openpyxl 官方教程](https://openpyxl.readthedocs.io/en/stable/tutorial.html)。
