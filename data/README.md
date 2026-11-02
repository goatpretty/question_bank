# 公开题库数据集

`dataset-v1.json` 由 `scripts/export-public-dataset.ts` 从 SQLite 数据库导出，
只包含 `topics`、`questions`、`question_options` 三张表的内容，不含任何用户数据。

## 结构

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-02T00:00:00.000Z",
  "license": "CC BY 4.0",
  "attribution": "Question Bank contributors",
  "counts": { "topics": 0, "questions": 0, "options": 0 },
  "topics": [
    { "id": "topic-id", "name": "章节名", "parentId": null, "sortOrder": 0 }
  ],
  "questions": [
    {
      "id": "question-id",
      "topicId": "topic-id",
      "type": "single",
      "content": "题干",
      "answer": "C",
      "analysis": "解析",
      "difficulty": 1,
      "score": 5,
      "tags": [],
      "options": [
        { "optionId": "A", "content": "选项内容", "sortOrder": 0 }
      ]
    }
  ]
}
```

- `answer` 与 `tags` 在导出时已从 JSON 字符串解析为对应类型。
- 题目 ID 与选项 ID 保持稳定，便于幂等导入。
- 来源与署名见 `data/ATTRIBUTION.md` 和 `docs/data-provenance.csv`。

## 重新导出

```bash
npm run db:export
```

导出脚本只读取题库三表；新增或修改题目后重新运行即可。

## 导入

`prisma/seed.ts` 会读取本文件并写入空数据库。也可以在已有数据库上运行：

```bash
npm run db:seed
```

导入逻辑按 ID 幂等处理，不会删除数据库中已有的其他数据。

## 许可

题库数据采用 CC BY 4.0，详见 `data/LICENSE`。项目代码采用 MIT。
