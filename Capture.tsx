import { useEffect, useRef, useState } from 'react';
import { IMAGE_ACCEPT } from './images';
import { Icon, message, usePhoto } from './presentation';

function Shot({ file, remove }: { file: File; remove: () => void }) {
  const url = usePhoto(file);
  return (
    <button
      type="button"
      aria-label={file.name + ' 촬영 목록에서 제거'}
      onClick={remove}
    >
      {url && <img alt="" src={url} />}
      <span>×</span>
    </button>
  );
}

export default function Capture({
  onReview,
  go,
}: {
  onReview: (files: File[]) => void;
  go: (page: string) => void;
}) {
  const [shots, setShots] = useState<File[]>([]);
  const [active, setActive] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recording = useRef<MediaStream | null>(null);
  const live = useRef(true);
  const lock = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);

  function stop() {
    recording.current?.getTracks().forEach((track) => track.stop());
    recording.current = null;
  }
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      stop();
    };
  }, []);
  useEffect(() => {
    const player = video.current;
    if (active && player && recording.current) {
      player.srcObject = recording.current;
      void player.play().catch(() => {});
    }
  }, [active]);
  async function enable() {
    if (requesting) return;
    setRequesting(true);
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          '이 브라우저에서 카메라를 열 수 없어요. 앨범에서 사진을 골라 주세요.',
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1600 },
          height: { ideal: 2000 },
        },
        audio: false,
      });
      if (!live.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recording.current = stream;
      setActive(true);
    } catch (err) {
      if (live.current)
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? '카메라 접근이 꺼져 있어요. 브라우저의 사이트 설정에서 카메라를 허용하거나, 아래에서 앨범을 선택해 주세요.'
            : '카메라를 사용할 수 없어요. 카메라 연결을 확인하거나 앨범에서 사진을 골라 주세요.',
        );
    } finally {
      if (live.current) setRequesting(false);
    }
  }
  async function capture() {
    const source = video.current;
    if (lock.current || !source?.videoWidth || shots.length >= 24) return;
    lock.current = true;
    setBusy(true);
    try {
      const frame = document.createElement('canvas');
      const factor = Math.min(
        1,
        1800 / Math.max(source.videoWidth, source.videoHeight),
      );
      frame.width = Math.round(source.videoWidth * factor);
      frame.height = Math.round(source.videoHeight * factor);
      const ctx = frame.getContext('2d');
      if (!ctx) throw new Error('촬영 화면을 읽지 못했어요.');
      ctx.drawImage(source, 0, 0, frame.width, frame.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        frame.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error('사진을 저장하지 못했어요.')),
          'image/jpeg',
          0.9,
        ),
      );
      const file = new File(
        [blob],
        '촬영 의류 ' + ++sequence.current + '.jpg',
        { type: 'image/jpeg' },
      );
      if (live.current) setShots((current) => [...current, file]);
    } catch (err) {
      if (live.current) setError(message(err));
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  const append = (files: FileList | null) => {
    if (!files?.length) return;
    const room = 24 - shots.length;
    const chosen = Array.from(files);
    if (chosen.length > room)
      setError(
        '한번에 24장까지 확인할 수 있어요. 남은 사진은 다음에 추가해 주세요.',
      );
    setShots((current) => [...current, ...chosen.slice(0, room)]);
  };
  return (
    <div className="wc wc-capture">
      <div className="wc-title">
        <div>
          <h1>연속 촬영</h1>
          <p>옷 한 벌씩 촬영하고 모아서 등록해요.</p>
        </div>
      </div>
      <div className="wc-viewfinder">
        {active ? (
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="카메라 미리보기"
          />
        ) : (
          <div className="wc-finder-start">
            <Icon name="camera" size={34} />
            <strong>
              {requesting ? '카메라를 여는 중' : '카메라 미리보기'}
            </strong>
            <button
              className="wc-solid light"
              disabled={requesting}
              onClick={enable}
            >
              카메라 켜기
            </button>
          </div>
        )}
        <div className="wc-reticle" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="wc-counter">{shots.length} / 24</span>
      </div>
      {error && (
        <p role="alert" className="wc-alert">
          {error}
        </p>
      )}
      <div className="wc-shutterbar">
        <button
          className="wc-tool"
          onClick={() => album.current?.click()}
          disabled={shots.length >= 24}
        >
          <Icon name="photo" />
          앨범
        </button>
        <button
          className="wc-shutter"
          disabled={!active || busy || shots.length >= 24}
          aria-label="사진 촬영"
          onClick={capture}
        >
          <i />
        </button>
        <button
          className="wc-tool"
          disabled={!shots.length}
          onClick={() => onReview(shots)}
        >
          <Icon name="check" />
          확인
        </button>
      </div>
      <input
        hidden
        ref={album}
        type="file"
        aria-label="촬영 대신 앨범 사진 선택"
        multiple
        accept={IMAGE_ACCEPT}
        onChange={(e) => {
          append(e.target.files);
          e.target.value = '';
        }}
      />
      {shots.length > 0 && (
        <>
          <div className="wc-film">
            {shots.map((file, i) => (
              <Shot
                key={file.name + file.lastModified + i}
                file={file}
                remove={() =>
                  setShots((current) => current.filter((_, n) => n !== i))
                }
              />
            ))}
          </div>
          <button className="wc-solid full" onClick={() => onReview(shots)}>
            촬영한 옷 {shots.length}벌 확인
          </button>
        </>
      )}
      <button className="wc-text" onClick={() => go('register')}>
        등록 방법으로 돌아가기
      </button>
    </div>
  );
}
