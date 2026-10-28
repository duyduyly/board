import fs from 'node:fs/promises';
import { stage } from '../assets/js/json/validator.js';
const old = JSON.parse(await fs.readFile('assets/data/mind-map-example.json', 'utf8'));
const images = old.cards.find((c) => c.extensions?.['card-atlas:images']).extensions[
  'card-atlas:images'
];
const imageId = Object.keys(images)[0];
const cards = [],
  relations = [],
  groups = [];
const scenes = [
  [
    'roadmap',
    '01 · Editorial Roadmap',
    'Sage / Minimal',
    'straight',
    '#e3f0e9',
    '#255c49',
    ['Khám phá', 'Thiết kế', 'Xây dựng', 'Ra mắt'],
    ['rounded', 'rounded', 'rounded', 'rounded'],
  ],
  [
    'architecture',
    '02 · Blueprint Architecture',
    'Blue / Monospace',
    'orthogonal',
    '#e7effa',
    '#254a7a',
    ['Client', 'Gateway', 'Service', 'Storage'],
    ['rectangle', 'hexagon', 'octagon', 'square'],
  ],
  [
    'process',
    '03 · Warm Decision Flow',
    'Cream / Process',
    'orthogonal',
    '#fff0d6',
    '#684c26',
    ['Yêu cầu', 'Đủ dữ liệu?', 'Phê duyệt', 'Bổ sung'],
    ['ellipse', 'diamond', 'circle', 'rectangle'],
  ],
  [
    'story',
    '04 · Soft Visual Story',
    'Rose / Serif',
    'curved',
    '#f7e6ee',
    '#6c3754',
    ['Quan sát', 'Ý tưởng', 'Câu chuyện', 'Góc nhìn'],
    ['rounded', 'heart', 'rounded', 'rounded'],
  ],
  [
    'learning',
    '05 · Learning Constellation',
    'Lavender / Mind Map',
    'curved',
    '#eae5f7',
    '#49366f',
    ['Chủ đề', 'Hiểu', 'Ghi nhớ', 'Thực hành', 'Điều chỉnh'],
    ['circle', 'triangle', 'star', 'isosceles-triangle', 'right-triangle'],
  ],
  [
    'sprint',
    '06 · Zigzag Sprint',
    'Teal / Energetic',
    'zigzag',
    '#e3f1f2',
    '#245b63',
    ['Mục tiêu', 'Thử nghiệm', 'Đo lường', 'Cải tiến'],
    ['arrow', 'rounded', 'rounded', 'rounded'],
  ],
];
for (const [i, [id, title, style, route, bg, ink, names, shapes]] of scenes.entries()) {
  const ox = (i % 2) * 2300 + 100,
    oy = Math.floor(i / 2) * 1700 + 120;
  const group = { id, title, cardIds: [] };
  groups.push(group);
  const fontFamily = i === 1 ? 'mono' : i === 3 ? 'serif' : 'system';
  const desc = [
    'Lộ trình trái sang phải. Mỗi bước một ý, cùng chiều rộng và mũi tên thẳng.',
    'Kiến trúc hệ thống: phân vai thành phần bằng hình dạng, nối vuông góc theo luồng dữ liệu.',
    'Quy trình có quyết định ở giữa. Hai nhánh Có / Không tách rõ, có đường quay lại.',
    'Ảnh và caption tạo câu chuyện. Serif, màu rose và đường cong mềm cho bảng cảm hứng.',
    'Cụm kiến thức tỏa từ tâm, biểu tượng ngắn gọn, đường cong kết nối các ý.',
    'Hành trình thử nghiệm lên xuống, mũi tên zigzag thể hiện các vòng cải tiến.',
  ][i];
  function add(slug, name, summary, x, y, w, h, kind = 'text', shape = 'rounded') {
    const card = {
      id: slug,
      title: name,
      summary,
      type: style,
      tags: ['design-example', id],
      position: { x: ox + x, y: oy + y },
      size: { width: w, height: h },
      style: { backgroundColor: bg, textColor: ink, borderColor: ink },
      extensions: {
        'card-atlas:node': { kind },
        'card-atlas:appearance': {
          shape,
          radius: 24,
          borderWidth: 1,
          align: i === 0 ? 'left' : 'center',
          shadow: i === 0 ? 'none' : 'soft',
          sizeMode: 'manual',
        },
        'card-atlas:typography': {
          title: { fontFamily, fontSize: 22 },
          summary: { fontFamily, fontSize: 15 },
          type: { fontFamily, fontSize: 11 },
        },
      },
    };
    cards.push(card);
    group.cardIds.push(slug);
    return card;
  }
  const heading = add(
    id + '-intro',
    title,
    desc + ' Zoom để đọc từng khu; double click mở Detail.',
    0,
    0,
    2000,
    150,
  );
  heading.extensions['card-atlas:appearance'] = {
    backgroundTransparent: true,
    borderTransparent: true,
    shadow: 'none',
    align: 'left',
  };
  heading.extensions['card-atlas:typography'].title.fontSize = 32;
  const positions =
    i === 2
      ? [
          [0, 500],
          [600, 430],
          [1300, 220],
          [1300, 850],
        ]
      : i === 4
        ? [
            [800, 550],
            [0, 240],
            [1500, 240],
            [0, 1000],
            [1500, 1000],
          ]
        : names.map((_, j) => [j * 530, i === 5 ? (j % 2 ? 800 : 350) : 400]);
  for (const [j, name] of names.entries()) {
    const [x, y] = positions[j];
    const shape = shapes[j];
    const symbolic = [
      'circle',
      'heart',
      'star',
      'triangle',
      'isosceles-triangle',
      'right-triangle',
      'diamond',
      'arrow',
    ].includes(shape);
    const c = add(
      id + '-' + j,
      name,
      symbolic
        ? ''
        : [
            [
              'Nhu cầu · nghiên cứu',
              'Prototype · trải nghiệm',
              'Triển khai · kiểm chứng',
              'Phát hành · phản hồi',
            ],
            ['Web / Mobile', 'Auth · routing', 'Business logic', 'Read / write'],
            ['Nhận thông tin', '', 'Chuyển xử lý', 'Cập nhật hồ sơ'],
            [
              '01 / Quan sát trước khi tạo',
              '',
              '02 / Chọn một thông điệp',
              'Ảnh dùng summary làm caption',
            ],
            ['', '', '', '', ''],
            ['', 'Làm bản nhỏ', 'Đọc kết quả', 'Lặp có chủ đích'],
          ][i][j],
      x,
      y,
      400,
      symbolic ? 400 : i === 3 ? 440 : 260,
      i === 0 ? 'card' : 'text',
      shape,
    );
    if (i === 3 && (j === 0 || j === 2)) {
      c.extensions['card-atlas:node'] = {
        kind: j === 0 ? 'image' : 'image-text',
        coverImageId: imageId,
        imageFit: j === 0 ? 'contain' : 'cover',
        imageAlt: 'Minh họa bài học offline',
      };
      c.extensions['card-atlas:images'] = images;
    }
    if (i === 5 && j === 0)
      c.extensions['card-atlas:metadata'] = { pinned: true, createdAt: '2026-10-28T00:00:00.000Z' };
    if (i === 0)
      c.extensions['card-atlas:metadata'] = {
        createdAt: '2026-10-28T00:00:00.000Z',
        createdDate: '2026-10-' + (20 + j),
      };
  }
  function edge(a, b, label = '', line = 'solid', arrow = 'end', r = route, branch = true) {
    relations.push({
      id: id + '-edge-' + relations.length,
      source: id + '-' + a,
      target: id + '-' + b,
      label,
      description: desc,
      style: { color: ink, line, arrow },
      extensions: {
        'card-atlas:edge': { route: r },
        'card-atlas:mind-map': { kind: branch ? 'branch' : 'reference', color: ink },
      },
    });
  }
  if (i === 2) {
    edge(0, 1);
    edge(1, 2, 'Có');
    edge(1, 3, 'Không', 'dashed');
    edge(3, 1, 'Kiểm tra lại', 'dotted', 'end', 'curved', false);
  } else if (i === 4) {
    for (let j = 1; j < names.length; j++) edge(0, j);
  } else {
    for (let j = 1; j < names.length; j++)
      edge(
        j - 1,
        j,
        i === 1 ? ['', 'HTTPS', 'request', 'read / write'][j] : i === 5 ? 'Vòng ' + j : '',
        j === 2 ? 'dashed' : 'solid',
        i === 1 && j === 3 ? 'both' : i === 3 && j === 1 ? 'none' : 'end',
      );
  }
  const note = add(
    id + '-note',
    'Thiết kế / Cách dùng',
    desc + ' Kéo tên khung để di chuyển cả bố cục. Rã nhóm giữ nguyên card.',
    0,
    1400,
    2000,
    140,
  );
  note.extensions['card-atlas:appearance'] = {
    backgroundTransparent: true,
    borderTransparent: true,
    shadow: 'none',
    align: 'left',
  };
  for (const card of cards.filter((c) => group.cardIds.includes(c.id))) {
    card.content =
      '# ' +
      card.title +
      '\n\n' +
      desc +
      '\n\n## Tái sử dụng thiết kế\n\nNhân bản cả group; cập nhật IDs, group cardIds, relations và Mind Map geometry. Giữ màu, kiểu chữ và khoảng cách nhất quán. Không nối xuyên các group mẫu. Card ghim chỉ xem; bỏ ghim trước khi sửa.\n\n## Cấu hình tham chiếu\n\n```json\n' +
      JSON.stringify({ size: card.size, style: card.style, extensions: card.extensions }, null, 2) +
      '\n```';
  }
  note.content +=
    '\n\n## Markdown\n\n- [x] Có thông điệp chính\n- [ ] Thay bằng nội dung thực\n\n| Định hướng | Áp dụng |\n| --- | --- |\n| Ít màu | Dễ đọc |\n\n> Chọn một phong cách cho một câu chuyện.\n\n```mermaid\nflowchart LR\n A[Observe] --> B[Design]\n B --> C[Improve]\n```';
}
// Group04: Cornell-inspired composition. Answers stay in Detail for honest retrieval.
const studyGroup = groups.find((g) => g.id === 'story');
studyGroup.title = '04 · Cornell Study Lab';
const studyCards = new Map(
  cards.filter((c) => studyGroup.cardIds.includes(c.id)).map((c) => [c.id, c]),
);
const studySources =
  '\n\n## Nguồn tham khảo\n\n- [Cornell Note Taking System](https://lsc.cornell.edu/how-to-study/taking-notes/cornell-note-taking-system/)\n- [Dunlosky et al., 2013: learning techniques](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html)\n- [CMU: spaced practice](https://www.cmu.edu/teaching/resources/instructionalstrategies/activelearningstrategies/spacedopractice/index.html)';
function study(id, title, summary, x, y, width, height, content) {
  const c = studyCards.get(id);
  Object.assign(c, {
    title,
    summary,
    type: 'Cornell · Recall · Review',
    position: { x: 2400 + x, y: 1820 + y },
    size: { width, height },
    style: {
      backgroundColor: id === 'story-0' ? '#e9eff7' : '#fffdf8',
      textColor: '#25364a',
      borderColor: '#93a5ba',
    },
    content: '# ' + title + '\n\n' + content + studySources,
  });
  c.extensions = {
    'card-atlas:node': { kind: 'text' },
    'card-atlas:appearance': {
      shape: 'rounded',
      radius: 16,
      borderWidth: 1,
      align: 'left',
      shadow: 'none',
      sizeMode: 'manual',
    },
    'card-atlas:typography': {
      title: { fontFamily: 'system', fontSize: 24 },
      summary: { fontFamily: 'system', fontSize: 18 },
    },
  };
}
study(
  'story-intro',
  '04 / CORNELL STUDY LAB',
  'Ghi bằng lời mình → đóng tài liệu → tự trả lời → kiểm tra → ôn lại sau.',
  0,
  0,
  2000,
  150,
  'Bố cục này áp dụng cấu trúc Cornell kết hợp retrieval practice và spaced practice. Không khẳng định đây là phương pháp tốt nhất cho mọi môn. Ví dụ cụ thể: phân biệt Java ArrayList và LinkedList.',
);
study(
  'story-0',
  '01 / CÂU HỎI GỢI NHỚ',
  'ArrayList lưu phần tử thế nào?\nLinkedList truy cập index ra sao?\nKhi nào chèn/xóa thực sự nhanh?',
  0,
  260,
  430,
  580,
  '## Trước khi xem đáp án\n\n1. Đóng tài liệu, trả lời từng câu bằng lời của bạn.\n2. Viết một ví dụ hoặc giải thích thành tiếng.\n3. Mở card Ghi chú cốt lõi để đối chiếu.\n4. Ghi câu trả lời sai vào nhật ký lỗi.',
);
study(
  'story-1',
  '02 / GHI CHÚ CỐT LÕI',
  'Một ý / một dòng. Viết giải thích và ví dụ bằng lời mình.\nĐáp án minh họa nằm trong Detail; hãy tự trả lời trước khi mở.',
  520,
  260,
  890,
  580,
  '## ArrayList vs LinkedList\n\n| Khía cạnh | ArrayList | LinkedList |\n| --- | --- | --- |\n| Cấu trúc | Mảng động chứa tham chiếu | Các node liên kết hai chiều |\n| get(index) | O(1) | O(n) |\n| Chèn ở giữa theo index | Dịch phần tử O(n) | Tìm node O(n), nối node O(1) |\n\n**Ví dụ:** đọc phần tử ngẫu nhiên nhiều thường nghiêng về ArrayList. Không kết luận LinkedList luôn nhanh hơn khi thêm/xóa: phải tính cả chi phí tìm vị trí và ngữ cảnh sử dụng.\n\nĐây là ghi chú mẫu; khi học thực tế hãy bổ sung nguồn của bài học.',
);
study(
  'story-2',
  '03 / TỰ KIỂM TRA',
  'Không nhìn ghi chú:\nGiải thích cho người mới trong 60 giây.\nTạo một tình huống chọn sai cấu trúc.\nChỉ mở đáp án sau khi đã thử.',
  1500,
  260,
  500,
  580,
  '## Mini quiz\n\n1. Cần get(i) nhiều: bạn ưu tiên gì và vì sao?\n2. LinkedList.add(index,x) có luôn O(1)?\n3. Chỉ biết Big-O đã đủ để chọn cấu trúc chưa?\n\n## Đối chiếu sau khi trả lời\n\n1. Thường là ArrayList: truy cập index O(1).\n2. Không, tìm vị trí theo index có thể O(n).\n3. Chưa: cần xem cách truy cập, bộ nhớ và workload.\n\nĐánh dấu: Đúng / Thiếu / Sai; viết lại lời giải cho câu sai.',
);
study(
  'story-3',
  '04 / ÔN CÁCH QUÃNG',
  'Lần sau: trả lời lại trước khi đọc.\nVí dụ lịch khởi đầu: ngày 1 → 3 → 7; rút ngắn nếu hay quên, giãn ra nếu nhớ tốt.',
  0,
  950,
  2000,
  210,
  '## Nhật ký ôn\n\n| Lần | Ngày dự kiến | Kết quả | Câu còn sai |\n| --- | --- | --- | --- |\n| 1 | Tự điền | | |\n| 2 | Tự điền | | |\n| 3 | Tự điền | | |\n\nLịch 1–3–7 chỉ là ví dụ thực hành, không phải khoảng cách tối ưu được chứng minh cho mọi người. Chọn khoảng cách theo độ khó, mức nhớ và ngày cần sử dụng. Đây là bảng ghi thủ công, app không tự nhắc lịch.',
);
study(
  'story-note',
  'TÓM TẮT BẰNG LỜI MÌNH',
  'Sau khi đóng tài liệu: viết 2–3 câu về điều đã hiểu, một lỗi đã sửa và một câu hỏi còn mở.',
  0,
  1280,
  2000,
  200,
  '## Tự tổng kết\n\n- Ý chính tôi giải thích được: …\n- Tôi từng nhầm …; nay sửa thành …\n- Tôi vẫn chưa hiểu …\n\nĐừng chỉ chép lại ghi chú. Thử nhớ trước rồi mới đối chiếu. Tóm tắt là phần kết thúc buổi học, không thay thế tự kiểm tra.',
);
for (const id of ['story-intro', 'story-note'])
  studyCards.get(id).extensions['card-atlas:appearance'] = {
    backgroundTransparent: true,
    borderTransparent: true,
    shadow: 'none',
    align: 'left',
  };
for (let i = relations.length - 1; i >= 0; i--)
  if (studyGroup.cardIds.includes(relations[i].source)) relations.splice(i, 1);
for (const [n, [source, target, label, route]] of [
  ['story-0', 'story-1', 'đối chiếu sau khi thử', 'straight'],
  ['story-1', 'story-2', 'đóng ghi chú', 'straight'],
  ['story-2', 'story-3', 'ôn lại sau', 'orthogonal'],
].entries())
  relations.push({
    id: 'study-edge-' + n,
    source,
    target,
    label,
    style: { color: '#597692', line: 'solid', arrow: 'end' },
    extensions: { 'card-atlas:edge': { route }, 'card-atlas:mind-map': { kind: 'branch' } },
  });
// Remaining scenes become learning workflows, keeping IDs stable for old references.
const learningProfiles = [
  [
    'roadmap',
    '01 · Spaced Study Plan',
    'Lập kế hoạch theo việc có thể làm được; quay lại tự kiểm tra ở các buổi khác nhau.',
    [
      [
        'Mục tiêu',
        'Sau buổi học, tôi giải thích và áp dụng được điều gì?',
        'Viết một mục tiêu quan sát được, ví dụ: chọn cấu trúc dữ liệu và giải thích trade-off. Chọn 3 câu hỏi kiểm tra tương ứng.',
      ],
      [
        'Học lần đầu',
        'Đọc một phần ngắn → ghi ý chính → tự giải thích.',
        'Ví dụ: đọc về get(index), viết một ví dụ sử dụng rồi đóng tài liệu. Không chỉ đánh dấu màu.',
      ],
      [
        'Ôn có khoảng cách',
        'Buổi sau: trả lời câu hỏi trước khi mở ghi chú.',
        'Tự điền ngày ôn. Nếu sai hoặc thiếu, xem lại rồi thử tiếp ở một thời điểm sau. Không có lịch tối ưu cố định cho mọi nội dung.',
      ],
      [
        'Áp dụng mới',
        'Dùng kiến thức vào một bài chưa làm.',
        'Đổi dữ kiện hoặc ngữ cảnh, giải thích vì sao lựa chọn vẫn đúng. Nếu không giải được, quay lại câu hỏi cụ thể còn yếu.',
      ],
    ],
  ],
  [
    'architecture',
    '02 · Concept & Comparison Map',
    'Nhãn đường nối phải giải thích quan hệ. Dùng sơ đồ để hiểu, sau đó tự dựng lại khi đã đóng nguồn.',
    [
      [
        'Java List',
        'Một giao diện; nhiều cách triển khai.',
        'Câu hỏi: cùng hợp đồng List nhưng vì sao chi phí thao tác khác nhau? Phân biệt giao diện với triển khai.',
      ],
      [
        'ArrayList',
        'Mảng động · get(index) O(1).',
        'Truy cập theo index nhanh; chèn giữa phải dịch phần tử. Viết một ví dụ workload phù hợp.',
      ],
      [
        'LinkedList',
        'Node liên kết · get(index) O(n).',
        'Nối node tại iterator đã có có thể O(1); tìm node theo index vẫn tốn O(n). Không suy ra thêm/xóa luôn nhanh hơn ArrayList.',
      ],
      [
        'Chọn theo workload',
        'Truy cập? Chèn ở đâu? Bộ nhớ?',
        'Giải thích lựa chọn cho: đọc ngẫu nhiên nhiều; duyệt tuần tự; chèn/xóa khi đã có iterator. Đo trong ngữ cảnh thực tế khi cần.',
      ],
    ],
  ],
  [
    'process',
    '03 · Worked Example → Try',
    'Xen kẽ lời giải mẫu với bài tự làm; giảm gợi ý khi người học đã vững. Đây là tiến trình luyện tập, không phải sơ đồ trang trí.',
    [
      [
        '01 / Xem lời giải',
        'Mở Detail: tìm phần tử lớn nhất trong [3, 1, 4].',
        'Khởi tạo max=3. So sánh 1: giữ 3. So sánh 4: cập nhật 4. Kết quả 4.\n\nVì sao khởi tạo bằng phần tử đầu? Với toàn số âm, max=0 sẽ sai.',
      ],
      [
        '02 / Giải thích',
        'Tại sao phải xét từng phần tử?',
        'Bất biến: sau mỗi bước, max là giá trị lớn nhất trong phần đã xét. Thử giải thích bằng lời mình trước khi đối chiếu lời giải.',
      ],
      [
        '03 / Tự làm',
        'Tìm max của [-8, -3, -5]. Không xem lời giải.',
        '## Đối chiếu sau khi thử\n\nKhởi tạo -8 → gặp -3 cập nhật → gặp -5 giữ nguyên. Kết quả -3. Nếu ra 0, kiểm tra khởi tạo.',
      ],
      [
        '04 / Biến thể',
        'Nếu mảng rỗng thì sao? Nếu có nhiều max bằng nhau?',
        'Xác định yêu cầu trước khi code: báo lỗi hay giá trị optional cho mảng rỗng? Chỉ trả giá trị hay cả index? Quyết định này tùy bài toán, không tự bịa đặc tả.',
      ],
    ],
  ],
  [
    'learning',
    '05 · Closed-book Recall Map',
    'Đóng tài liệu rồi tự điền các nhánh. Sau đó đối chiếu và đánh dấu phần thiếu; không dùng hình phức tạp để chứa chữ.',
    [
      [
        'Chủ đề cần nhớ',
        'Điền tên bài học và một câu hỏi trung tâm.',
        'Trước khi bắt đầu: đóng ghi chú, đặt thời gian ngắn vừa sức. Tự dựng lại các ý, không sao chép mẫu.',
      ],
      [
        'Định nghĩa?',
        'Giải thích bằng lời mình, tránh đọc thuộc câu chữ.',
        'Tự điền: khái niệm là gì? Có đặc điểm nào bắt buộc?',
      ],
      [
        'Ví dụ?',
        'Đưa một ví dụ và một phản ví dụ.',
        'Tự điền: ví dụ nào thỏa định nghĩa? Trường hợp gần giống nhưng không thỏa là gì?',
      ],
      [
        'Vì sao / khi nào?',
        'Nêu quan hệ nguyên nhân hoặc điều kiện áp dụng.',
        'Tự điền: khi nào dùng được? Khi nào không? Có giả định nào cần kiểm tra?',
      ],
      [
        'Còn thiếu gì?',
        'Mở nguồn, sửa lỗi rồi hẹn một lần thử lại.',
        'Ghi rõ điều thiếu hoặc sai và cách sửa. Lần ôn sau trả lời lại từ trí nhớ. Không tự đánh giá chỉ dựa trên cảm giác quen mắt.',
      ],
    ],
  ],
  [
    'sprint',
    '06 · Mistake → Feedback → Retry',
    'Biến lỗi thành câu hỏi để thử lại. Zigzag diễn tả các vòng sửa; lịch sử lỗi ghi thủ công, không tự chấm điểm.',
    [
      [
        'Bài đã thử',
        'Ghi đề và câu trả lời ban đầu; đừng xóa dấu vết lỗi.',
        'Ví dụ: tìm max của mảng số âm, nhưng kết quả ban đầu là 0. Card được ghim như đề gốc; bỏ ghim nếu cần sửa.',
      ],
      [
        'Phân tích lỗi',
        'Sai ở bước nào? Do thiếu hiểu hay do thao tác?',
        'Ví dụ: khởi tạo max=0 thay vì phần tử đầu. Viết lý do lỗi xảy ra và một cách nhận ra lỗi tương tự.',
      ],
      [
        'Phản hồi / sửa',
        'Đối chiếu lời giải, giải thích vì sao cách sửa đúng.',
        'Ví dụ: với mảng không rỗng, khởi tạo từ phần tử đầu rồi duyệt phần còn lại. Ghi nguồn đáp án hoặc hỏi người hướng dẫn nếu chưa chắc.',
      ],
      [
        'Thử lại sau',
        'Làm biến thể không nhìn lời giải, ghi kết quả.',
        'Ví dụ: [-10,-2,-7]. Đáp án -2 chỉ xem sau khi làm. Tự điền ngày thử lại và kết quả; lặp nếu còn sai.',
      ],
    ],
  ],
];
const methodSource =
  '\n\n## Cơ sở phương pháp\n\n[IES: Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1) · [Tổng quan Dunlosky et al.](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html)\n\nBố cục và bảng ghi lỗi là cách áp dụng trong mẫu, không phải bằng chứng rằng Card Atlas đã được thử nghiệm. Không có chấm điểm, nhắc lịch hoặc che đáp án tự động.';
for (const [id, title, description, items] of learningProfiles) {
  const g = groups.find((g) => g.id === id);
  g.title = title;
  const intro = cards.find((c) => c.id === id + '-intro');
  intro.title = title;
  intro.summary = description;
  intro.content = '# ' + title + '\n\n' + description + methodSource;
  const note = cards.find((c) => c.id === id + '-note');
  note.title = 'KẾT THÚC / TỰ ĐÁNH GIÁ';
  note.summary =
    'Tôi đã trả lời được gì mà không xem? Câu nào còn sai? Lần sau tôi sẽ thử lại điều gì?';
  note.content =
    '# Tự đánh giá\n\n- Điều đã làm được: …\n- Bằng chứng (câu trả lời / bài giải): …\n- Điều cần sửa: …\n- Ngày thử lại: …' +
    methodSource;
  for (const [j, [name, summary, body]] of items.entries()) {
    const c = cards.find((c) => c.id === id + '-' + j);
    c.title = name;
    c.summary = summary;
    c.type = 'Learning · Practice';
    c.content = '# ' + name + '\n\n' + body + methodSource;
    c.extensions['card-atlas:node'] = { kind: 'text' };
    c.extensions['card-atlas:appearance'] = {
      shape: 'rounded',
      radius: 16,
      borderWidth: 1,
      align: 'left',
      shadow: 'none',
      sizeMode: 'manual',
    };
    c.extensions['card-atlas:typography'] = {
      title: { fontFamily: 'system', fontSize: 24 },
      summary: { fontFamily: 'system', fontSize: 18 },
    };
    c.size = { width: 420, height: 300 };
  }
  for (let j = relations.length - 1; j >= 0; j--)
    if (g.cardIds.includes(relations[j].source)) relations.splice(j, 1);
  const links =
    id === 'learning'
      ? [
          [0, 1, 'định nghĩa'],
          [0, 2, 'minh họa'],
          [0, 3, 'giải thích'],
          [0, 4, 'đối chiếu'],
        ]
      : id === 'architecture'
        ? [
            [0, 1, 'triển khai bởi'],
            [0, 2, 'triển khai bởi'],
            [1, 3, 'cân nhắc'],
            [2, 3, 'cân nhắc'],
          ]
        : items.slice(1).map((_, j) => [j, j + 1, ['tiếp tục', 'tự thử', 'kiểm chứng'][j]]);
  for (const [j, [a, b, label]] of links.entries())
    relations.push({
      id: id + '-study-' + j,
      source: id + '-' + a,
      target: id + '-' + b,
      label,
      style: {
        color: cards.find((c) => c.id === id + '-0').style.textColor,
        line: 'solid',
        arrow: 'end',
      },
      extensions: {
        'card-atlas:edge': {
          route:
            id === 'learning'
              ? 'curved'
              : id === 'architecture'
                ? 'orthogonal'
                : id === 'sprint'
                  ? 'zigzag'
                  : 'straight',
        },
        'card-atlas:mind-map': { kind: id === 'architecture' && j === 3 ? 'reference' : 'branch' },
      },
    });
}
// Comparison map uses a split and merge, with room for orthogonal labels.
for (const [j, [x, y]] of [
  [0, 550],
  [650, 260],
  [650, 860],
  [1450, 550],
].entries())
  Object.assign(cards.find((c) => c.id === 'architecture-' + j).position, {
    x: 2400 + x,
    y: 120 + y,
  });
for (let j = 0; j < 4; j++)
  Object.assign(cards.find((c) => c.id === 'process-' + j).position, {
    x: 100 + j * 520,
    y: 1820 + 480,
  });
const project = {
  version: '1.0',
  metadata: {
    title: 'Card Atlas · Design Styles',
    description:
      '6 nhóm độc lập, mỗi nhóm là một phong cách thiết kế hoàn chỉnh với mũi tên phù hợp.',
  },
  canvas: { zoom: 0.5, position: { x: 0, y: 0 } },
  cards,
  relations,
  extensions: {
    'card-atlas:groups': { groups },
    'card-atlas:mind-map': { rootId: 'roadmap-0' },
    'card-atlas:views': {
      mindMap: {
        positions: Object.fromEntries(cards.map((c) => [c.id, c.position])),
        sizes: Object.fromEntries(cards.map((c) => [c.id, c.size])),
        viewport: { zoom: 0.5, position: { x: 0, y: 0 } },
      },
    },
  },
};
const result = stage(JSON.stringify(project));
if (result.errors.length) throw Error(JSON.stringify(result.errors));
await fs.writeFile('assets/data/showcase-example.json', JSON.stringify(project, null, 2) + '\n');
console.log(cards.length, relations.length, 'valid');
