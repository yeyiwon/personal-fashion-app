import type { Category, Outfit } from './domain';
import type { StudioGarment } from './studio';

const sampleDate = '2026-11-27T00:00:00.000Z';

// These fixtures are read directly. They never enter the private wardrobe provider.
const pieces: [
  slug: string,
  name: string,
  category: Category,
  color: string,
  material: string,
][] = [
  ['trench', '크롭 트렌치', '아우터', '#b7aa94', '코튼 개버딘'],
  ['dress', '와인 슬립 드레스', '원피스', '#752f40', '새틴'],
  ['bag', '에스프레소 숄더백', '가방', '#513831', '가죽'],
  ['bangle', '오픈 뱅글', '기타', '#b9b8bc', '실버'],
  ['shirt', '아이보리 포플린 셔츠', '상의', '#e4dfd2', '코튼 포플린'],
  ['skirt', '플레어 미디 스커트', '하의', '#28272a', '크레이프'],
  ['slingback', '스퀘어 슬링백', '신발', '#302d2c', '가죽'],
  ['merino', '네이비 메리노 니트', '상의', '#282b3d', '메리노 울'],
  ['trouser', '그래파이트 울 트라우저', '하의', '#51524f', '울 트윌'],
  ['loafer', '블랙 페니 로퍼', '신발', '#2c2927', '가죽'],
  ['trucker', '워시드 데님 트러커', '아우터', '#515458', '코튼 데님'],
  ['jeans', '인디고 스트레이트 진', '하의', '#344355', '데님'],
  ['sneaker', '오프화이트 스니커즈', '신발', '#dcd7c7', '가죽'],
  ['blazer', '차콜 테일러드 재킷', '아우터', '#47484a', '울 트윌'],
  ['tank', '리브 슬리브리스', '상의', '#e1dac6', '코튼 리브'],
  ['polo', '버터 옐로 리브 폴로', '상의', '#e7cf87', '골지 니트'],
  ['cardigan', '로즈 모헤어 카디건', '상의', '#c898a2', '모헤어 혼방'],
  ['bomber', '세이지 봄버 재킷', '아우터', '#7d8468', '새틴 트윌'],
  ['pleats', '슬레이트 블루 플리츠 팬츠', '하의', '#879ab0', '폴리 트윌'],
  ['slingbag', '플럼 퀼팅 슬링백', '가방', '#65405f', '나일론'],
  ['scarf', '라일락 스트라이프 스카프', '기타', '#aa91b9', '실크'],
];

export const sampleGarments: StudioGarment[] = pieces.map(
  ([slug, name, category, color, material]) => ({
    id: `sample-${slug}`,
    name,
    category,
    color,
    material,
    image: `/media/capsule/${slug}.webp`,
    condition: '착용 중',
    price: null,
    createdAt: sampleDate,
    updatedAt: sampleDate,
  }),
);

const styledLooks: [slug: string, name: string, garments: string[]][] = [
  ['evening', '와인과 스톤', ['dress', 'trench', 'bag', 'bangle']],
  ['sand', '스톤 테일러링', ['trench', 'shirt', 'skirt', 'slingback']],
  ['graphite', '그래파이트 레이어', ['trench', 'shirt', 'trouser', 'loafer']],
  ['navy', '네이비와 그래파이트', ['merino', 'trouser', 'loafer']],
  ['denim', '워시드 데님', ['trucker', 'shirt', 'jeans', 'sneaker']],
];

export const sampleOutfits: Outfit[] = styledLooks.map(
  ([slug, name, garments]) => ({
    id: `sample-${slug}`,
    name,
    garmentIds: garments.map((id) => `sample-${id}`),
    createdAt: sampleDate,
    updatedAt: sampleDate,
  }),
);
