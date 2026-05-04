# Works Import Format

Additional Aquinas works should be parsed into JSON and listed in `neo-summa/public/works/manifest.json`.

The Aristotle commentary importer lives at `opera_parser.js`. Run it from the repository root with:

```sh
node opera_parser.js /Users/michael.mangialardi/Downloads/AquinasOperaOmnia-master/english /Users/michael.mangialardi/neo-summa/neo-summa/public/works
```

It writes one JSON file per work, refreshes the manifest, and copies the source HTML into `neo-summa/public/works/source` so parsed records can link back to stable HTML anchors.

For the current reader, the richest supported shape is the Summa article format:

```json
{
  "meta": {
    "title": "Commentary on John",
    "questions": []
  },
  "articles": [
    {
      "id": "john-1-1",
      "part": "JOHN",
      "question": 1,
      "article": 1,
      "headingLabel": "Lecture 1",
      "title": "Lecture 1",
      "source": {
        "file": "CommentaryOnJohn1.htm",
        "anchor": "1",
        "href": "/works/source/CommentaryOnJohn1.htm#1"
      },
      "objections": [],
      "sedContra": { "english": "", "latin": "" },
      "respondeo": { "english": "Parsed English text", "latin": "Parsed Latin text" },
      "replies": [],
      "authoritiesAnswered": [],
      "authoritiesInvoked": [],
      "authoritiesDiscussed": [],
      "outboundRefs": [],
      "inboundRefs": []
    }
  ]
}
```

For non-Summa works that do not have objections/sed contra/replies, place the main body in `respondeo.english` and `respondeo.latin`. That gives search, hover previews, and future cross-work linking one stable field to target.

Manifest entries should look like:

```json
{
  "id": "commentary-on-john",
  "title": "Commentary on John",
  "kind": "article-collection",
  "path": "/works/commentary-on-john.json",
  "routeBase": "/works/commentary-on-john"
}
```

When converting from HTML, preserve original anchor IDs when possible in `id`, and store detected internal links in `outboundRefs`. Cross-work references can later use:

```json
{ "workId": "summa-theologica", "part": "FP", "question": 1, "article": 1 }
```
