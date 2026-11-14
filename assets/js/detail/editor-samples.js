/** Ready-to-insert samples. Text inside is placeholder user content, so it is not translated. */
export const SAMPLES = [
  [
    'samplesGroupHTML',
    [
      ['sampleAlert', '<div class="alert alert-info"><strong>💡 ...:</strong> ...</div>'],
      [
        'sampleCard',
        '<div class="card"><div class="card-body"><h5 class="card-title">...</h5><p class="card-text mb-0">...</p></div></div>',
      ],
      [
        'sampleColumns',
        '<div class="row g-3"><div class="col-md-6"><div class="card h-100"><div class="card-body"><h5 class="card-title">A</h5><p class="card-text mb-0">...</p></div></div></div><div class="col-md-6"><div class="card h-100"><div class="card-body"><h5 class="card-title">B</h5><p class="card-text mb-0">...</p></div></div></div></div>',
      ],
      [
        'sampleTable',
        '<table class="table table-bordered table-sm"><thead class="table-light"><tr><th scope="col">...</th><th scope="col">...</th></tr></thead><tbody><tr><td>...</td><td>...</td></tr></tbody></table>',
      ],
      [
        'sampleListGroup',
        '<ul class="list-group mb-3"><li class="list-group-item"><span class="badge text-bg-primary me-2">1</span>...</li><li class="list-group-item"><span class="badge text-bg-primary me-2">2</span>...</li></ul>',
      ],
      [
        'sampleCode',
        '<p>...:</p><pre><code class="language-javascript">const total = items.length;</code></pre>',
      ],
      [
        'sampleMermaid',
        '<pre><code class="language-mermaid">flowchart LR\n  A["Start"] --&gt; B{"OK?"}\n  B --&gt;|yes| C["Done"]\n  B --&gt;|no| A</code></pre>',
      ],
      [
        'sampleVideo',
        '<p><a class="board-video" href="https://www.youtube.com/watch?v=VIDEO_ID">...</a></p>',
      ],
      [
        'sampleFigure',
        '<figure class="text-center"><img class="img-fluid rounded" src="https://example.com/image.png" alt="..."><figcaption class="small text-body-secondary">...</figcaption></figure>',
      ],
    ],
  ],
  [
    'samplesGroupCSS',
    [
      [
        'sampleThemeBox',
        '<div class="p-3 rounded border border-success-subtle bg-success-subtle text-success-emphasis">...</div>',
      ],
      ['sampleSpacing', '<div class="p-3 mb-3 border rounded bg-body-tertiary">...</div>'],
      ['sampleText', '<p class="text-center fs-4 fw-bold text-primary">...</p>'],
      [
        'sampleFlow',
        '<div class="d-flex flex-wrap align-items-center gap-2 mb-2"><div class="px-3 py-2 rounded border bg-primary-subtle text-primary-emphasis border-primary-subtle">1</div><span class="fs-4 text-body-secondary">→</span><div class="px-3 py-2 rounded border bg-success-subtle text-success-emphasis border-success-subtle">2</div></div>',
      ],
      [
        'sampleInlineStyle',
        '<p style="background-color:#e3f0e9;color:#255c49;padding:12px">...</p>',
      ],
    ],
  ],
];

/** Lesson building blocks for the visual library; same placeholder convention as SAMPLES. */
export const LESSON_SAMPLES = [
  ['sampleLessonIntro', '<h1>...</h1><p class="lead">...</p>'],
  ['sampleLessonIdea', '<div class="alert alert-info"><strong>💡 ...:</strong> ...</div>'],
  ['sampleLessonMistake', '<div class="alert alert-warning"><strong>⚠️ ...:</strong> ...</div>'],
  [
    'sampleLessonSummary',
    '<div class="alert alert-success"><ul class="mb-0"><li>...</li><li>...</li><li>...</li></ul></div>',
  ],
  [
    'sampleLessonCompare',
    '<table class="table table-bordered table-sm"><thead class="table-light"><tr><th scope="col">...</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody><tr><th scope="row">...</th><td>...</td><td>...</td></tr><tr><th scope="row">...</th><td>...</td><td>...</td></tr></tbody></table>',
  ],
  [
    'sampleLessonDoDont',
    '<div class="row g-3"><div class="col-md-6"><div class="card h-100 border-success-subtle"><div class="card-body"><h5 class="card-title">✅ ...</h5><ul class="mb-0"><li>...</li><li>...</li></ul></div></div></div><div class="col-md-6"><div class="card h-100 border-danger-subtle"><div class="card-body"><h5 class="card-title">❌ ...</h5><ul class="mb-0"><li>...</li><li>...</li></ul></div></div></div></div>',
  ],
  ['sampleLessonSteps', '<ol><li>...</li><li>...</li><li>...</li></ol>'],
  [
    'sampleLessonQuiz',
    '<h2>...</h2><ol><li>...?</li><li>...?</li></ol><h2>...</h2><ol><li>...</li><li>...</li></ol>',
  ],
  [
    'sampleLessonRelated',
    '<footer class="mt-4 pt-3 border-top small text-body-secondary"><p class="mb-1"><strong>...:</strong> ...</p><p class="mb-1"><strong>...:</strong> ...</p></footer>',
  ],
];
