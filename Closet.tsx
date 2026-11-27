import { Aperture } from './Aperture';
import { Control, Feedback, Field } from './LiquidControls';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GarmentForm } from './GarmentForm';
import { deleteGarment } from './storage';
import { IMAGE_ACCEPT } from './images';
import { GarmentPhoto, Icon, Sheet, message } from './presentation';
import { useStudio, type PageProps } from './studio';
import Capture from './Capture';
import PurchaseIntake from './PurchaseIntake';
import OutfitCanvas, { SavedOutfits } from './OutfitCanvas';
import ClosetRail from './ClosetRail';
import './closet.css';

function Row({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: string;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <Control className="wc-row" onClick={onClick}>
      <span className="wc-row-icon">
        <Icon name={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Icon name="right" size={16} />
    </Control>
  );
}
function Registration({ page, go }: PageProps) {
  const { mode, setMode, refresh, setActiveGarmentId, notify } = useStudio();
  const [files, setFiles] = useState<File[]>([]);
  const completed = useRef(0);
  const album = useRef<HTMLInputElement>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  function review(items: File[]) {
    if (!items.length) return;
    setMode('personal');
    completed.current = 0;
    setFiles(items);
  }
  function enterReal(target: string) {
    setMode('personal');
    go(target);
  }
  const camera = page === 'camera';
  return (
    <>
      {camera ? (
        <Capture go={go} onReview={review} />
      ) : (
        <div className="wc wc-narrow">
          <div className="wc-title">
            <div>
              <h1>옷 등록</h1>
              <p>
                {mode === 'sample'
                  ? '등록하는 옷은 개인 옷장에 보관해요.'
                  : '한 벌씩 찍거나 앨범에서 여러 장을 골라 주세요.'}
              </p>
            </div>
          </div>
          <Control
            className="wc-camera-entry"
            onClick={() => enterReal('camera')}
          >
            <span className="wc-camera-lens">
              <Aperture />
            </span>
            <span>
              <strong>연속 촬영</strong>
              <small>한 벌씩 담고, 한 번에 확인</small>
            </span>
            <Icon name="right" size={19} />
          </Control>
          <div className="wc-list">
            <Row
              icon="photo"
              title="앨범에서 선택"
              detail="JPG, PNG, WebP · 여러 장 선택"
              onClick={() => {
                setMode('personal');
                album.current?.click();
              }}
            />
            <Row
              icon="save"
              title="상품 링크 등록"
              detail="상품 주소와 구매 정보를 함께 보관"
              onClick={() => enterReal('purchase-link')}
            />
            <Row
              icon="layer"
              title="구매 내역 가져오기"
              detail="구매 내역 캡처에서 직접 입력"
              onClick={() => enterReal('purchases')}
            />
            <Row
              icon="settings"
              title="AI 인식·배경 제거"
              detail="분석 범위와 연결 상태 확인"
              onClick={() => go('recognition')}
            />
          </div>
          <Field
            hidden
            type="file"
            ref={album}
            aria-label="앨범 사진 파일"
            accept={IMAGE_ACCEPT}
            multiple
            onChange={(e) => {
              review(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <p className="wc-hint">사진 한 장당 최대 16MB · 3,200만 화소</p>
        </div>
      )}
      {offline && (
        <p className="wc-alert">
          오프라인이에요. 선택한 사진은 이 기기에서 등록할 수 있어요.
        </p>
      )}
      {files.length > 0 && (
        <GarmentForm
          files={files}
          onClose={() => {
            setFiles([]);
            if (completed.current) {
              go('closet');
            }
          }}
          onSaved={(g) => {
            completed.current++;
            setActiveGarmentId(g.id);
            void refresh();
            notify(g.name + '을(를) 저장했어요.');
          }}
        />
      )}
    </>
  );
}

const scenarios: Record<string, [string, string, string]> = {
  recognition: [
    'AI 인식·배경 제거',
    '사진의 분류·소재 제안과 배경 분리는 외부 서비스 연결을 기다리고 있어요. 현재는 원본을 보관하고 대표색을 기기에서 추출해요.',
    '옷 등록',
  ],
  'recognition-pending': [
    '의류 분석 대기',
    'AI 인식이 연결되면 여기에서 처리 상태를 확인해요. 지금은 직접 분류하여 등록할 수 있어요.',
    '직접 분류하기',
  ],
  'analysis-error': [
    '의류 분석 실패',
    '자동 분석에 실패해도 원본을 보관하고, 이름과 분류를 직접 정정해 등록하는 화면이에요.',
    '직접 분류하기',
  ],
  offline: [
    '오프라인 등록',
    '사진과 옷 정보는 이 기기에 저장할 수 있어요. 외부 분석을 사용하려면 인터넷 연결이 필요해요.',
    '기기에서 등록',
  ],
  'camera-denied': [
    '카메라 접근',
    '카메라 권한이 없을 때 브라우저의 사이트 설정에서 권한을 바꾸거나 앨범을 사용할 수 있어요.',
    '등록 방법 선택',
  ],
  duplicate: [
    '중복 의류 확인',
    '같은 파일이 이미 등록되어 있으면 기존 사진과 새 사진을 확인할 수 있어요. 중복 파일은 한 번만 저장해요.',
    '옷 등록',
  ],
  review: [
    '등록 확인',
    '등록할 사진을 선택하면 의류 이름·분류·대표색을 확인할 수 있어요.',
    '사진 선택하기',
  ],
};
function Recognition({ page, go }: PageProps) {
  const [title, desc, cta] = scenarios[page] ?? scenarios.recognition!;
  const { garments } = useStudio();
  const item = garments[0];
  return (
    <div className="wc wc-narrow">
      <div className="wc-title">
        <div>
          <h1>{title}</h1>
          <p>{page === 'recognition' ? '외부 API 연동 필요' : '화면 예시'}</p>
        </div>
      </div>
      {item && (
        <div className="wc-recognition">
          <GarmentPhoto item={item} />
          <span>
            <i style={{ background: item.color }} />
            등록된 대표색
          </span>
        </div>
      )}
      <p className="wc-description">{desc}</p>
      <Control className="wc-solid" onClick={() => go('register')}>
        {cta}
      </Control>
      {page === 'recognition' && (
        <details className="wc-states">
          <summary>등록 중 만날 수 있는 상태</summary>
          {Object.entries(scenarios)
            .filter(([key]) => key !== 'recognition')
            .map(([key, [label]]) => (
              <Control key={key} onClick={() => go(key)}>
                {label}
                <Icon name="right" size={15} />
              </Control>
            ))}
        </details>
      )}
    </div>
  );
}
function GarmentDetail({ go }: PageProps) {
  const {
    garments,
    mode,
    activeGarmentId,
    selectedIds,
    setSelectedIds,
    refresh,
    notify,
  } = useStudio();
  const item = garments.find((g) => g.id === activeGarmentId) ?? garments[0];
  const [panel, setPanel] = useState<null | 'edit' | 'delete'>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!item)
    return (
      <div className="wc wc-empty">
        <h1>선택할 옷이 없어요</h1>
        <Control className="wc-solid" onClick={() => go('closet')}>
          옷장으로
        </Control>
      </div>
    );
  const current = item;
  const metadata: [string, ReactNode][] = [
    ['분류', item.category],
    ['상태', item.condition],
    [
      '대표색',
      <span className="wc-color">
        <i style={{ background: item.color }} />
        {item.color.toUpperCase()}
      </span>,
    ],
  ];
  if (item.material) metadata.push(['소재', item.material]);
  if (item.price !== null)
    metadata.push(['구매 가격', item.price.toLocaleString('ko-KR') + '원']);
  if (item.purchase) {
    metadata.push(['구매일', item.purchase.purchasedAt]);
    if (item.purchase.shop) metadata.push(['판매처', item.purchase.shop]);
    if (item.purchase.url)
      metadata.push([
        '상품 링크',
        <a href={item.purchase.url} target="_blank" rel="noopener noreferrer">
          판매처 열기 ↗
        </a>,
      ]);
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteGarment(current.id);
      await refresh();
      setSelectedIds(selectedIds.filter((id) => id !== current.id));
      notify('의류를 삭제했어요.');
      go('closet');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wc wc-detail">
      <Control className="wc-back" onClick={() => go('closet')}>
        <Icon name="back" size={16} />
        옷장
      </Control>
      <div className="wc-detail-layout">
        <div className="wc-product-photo">
          <GarmentPhoto item={item} shared />
          <span>{mode === 'sample' ? '샘플 의류' : '보유 의류'}</span>
        </div>
        <div>
          <div className="wc-title">
            <div>
              <p>{item.category}</p>
              <h1>{item.name}</h1>
            </div>
          </div>
          <dl className="wc-facts">
            {metadata.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="wc-actions">
            <Control
              className="wc-solid"
              onClick={() => {
                if (!selectedIds.includes(item.id)) {
                  if (selectedIds.length >= 32) {
                    notify('코디 한 개에 32벌까지 담을 수 있어요.');
                    return;
                  }
                  setSelectedIds([...selectedIds, item.id]);
                }
                go('direct');
              }}
            >
              <Icon name="layer" size={16} />
              코디에 담기
            </Control>
            {mode === 'personal' && (
              <Control className="wc-outline" onClick={() => setPanel('edit')}>
                의류 정보 수정
              </Control>
            )}
          </div>
          {mode === 'personal' && (
            <Control
              className="wc-text"
              onClick={() => {
                setError('');
                setPanel('delete');
              }}
            >
              이 의류 삭제
            </Control>
          )}
        </div>
      </div>
      {panel === 'edit' && (
        <GarmentForm
          files={[]}
          edit={item}
          onClose={() => setPanel(null)}
          onSaved={() => {
            void refresh();
            notify('변경사항을 저장했어요.');
          }}
        />
      )}
      {panel === 'delete' && (
        <Sheet
          title="이 의류를 삭제할까요?"
          onClose={() => {
            if (!busy) setPanel(null);
          }}
        >
          <p>{item.name}의 원본 사진과 정보가 삭제돼요.</p>
          {error && (
            <Feedback role="alert" className="wc-alert">
              {error}
            </Feedback>
          )}
          <div className="wc-actions">
            <Control
              className="wc-outline"
              disabled={busy}
              onClick={() => setPanel(null)}
            >
              취소
            </Control>
            <Control className="wc-solid" disabled={busy} onClick={remove}>
              삭제하기
            </Control>
          </div>
        </Sheet>
      )}
    </div>
  );
}
export default function Closet(props: PageProps) {
  const { mode } = useStudio();
  if (props.page === 'direct') return <OutfitCanvas key={mode} {...props} />;
  if (props.page === 'saved') return <SavedOutfits {...props} />;
  if (props.page === 'garment') return <GarmentDetail key={mode} {...props} />;
  if (props.page === 'register' || props.page === 'camera')
    return <Registration {...props} />;
  if (props.page === 'purchases' || props.page === 'purchase-link')
    return <PurchaseIntake key={props.page} {...props} />;
  if (scenarios[props.page]) return <Recognition {...props} />;
  return <ClosetRail {...props} />;
}
