# 示例输出

执行 `python examples/make_example.py` 生成含“原味”“香辣味”两个工作表的 `products.xlsx`。

执行 `python scripts/build_job.py examples/products.xlsx dist/背标出图.jsx` 后：

```text
dist/背标出图.jsx
dist/背标出图.job.json
```

在本机 Photoshop 运行后预期产生：

```text
桌面/背标输出_<时间戳>/
  1_示例脆脆虾（原味）.jpg
  1_示例脆脆虾（原味）.psd
  2_示例脆脆虾（香辣味）.jpg
  2_示例脆脆虾（香辣味）.psd
  运行报告.txt
```

成功报告的示意内容：

```text
已导出：示例脆脆虾（原味）

已导出：示例脆脆虾（香辣味）
```

以上是预期目录和报告示例，仓库不提供冒充实际 Photoshop 导出的 JPG。`expected-products.json` 是示例输入对应的真实 Python 提取结果，可用于核对读取和显示精度。
