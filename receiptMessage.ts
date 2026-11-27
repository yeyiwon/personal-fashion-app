/** Display a single locally selected RFC 822 message as text. Attachments and HTML parts stay unopened. */
export async function readReceiptMessage(file: File) {
  if (file.size > 4 * 1024 * 1024)
    throw Error('4MB 이하의 주문 이메일 파일을 선택해 주세요.');
  const raw = (await file.text()).replace(/\r\n/g, '\n');
  const split = raw.indexOf('\n\n');
  if (split < 1 || !/^[-A-Za-z]+:/m.test(raw.slice(0, split)))
    throw Error('.eml 형식의 이메일 원본을 선택해 주세요.');
  const header = raw.slice(0, split).replace(/\n[ \t]+/g, ' ');
  const body = raw.slice(split + 2);
  const get = (headers: string, key: string) =>
    new RegExp('^' + key + ':\\s*(.*)$', 'im').exec(headers)?.[1]?.trim() ?? '';
  const plain = (headers: string, body: string): string => {
    if (/attachment/i.test(get(headers, 'Content-Disposition'))) return '';
    const type = get(headers, 'Content-Type');
    const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(type);
    if (boundary) {
      for (const part of body
        .split('--' + (boundary[1] ?? boundary[2]))
        .slice(1)) {
        const source = part.replace(/^\n/, '');
        const gap = source.indexOf('\n\n');
        if (gap < 0) continue;
        const h = source.slice(0, gap).replace(/\n[ \t]+/g, ' ');
        if (!/^(text\/plain|multipart\/)/i.test(get(h, 'Content-Type')))
          continue;
        const text = plain(h, source.slice(gap + 2));
        if (text) return text;
      }
      return '';
    }
    if (type && !/^text\/plain/i.test(type)) return '';
    const enc = get(headers, 'Content-Transfer-Encoding').toLowerCase();
    const charset = /charset=["']?([^;"'\s]+)/i.exec(type)?.[1] ?? 'utf-8';
    try {
      if (enc === 'base64')
        return new TextDecoder(charset).decode(
          Uint8Array.from(atob(body.replace(/\s/g, '')), (c) =>
            c.charCodeAt(0),
          ),
        );
      if (enc === 'quoted-printable') {
        const chars = body
          .replace(/=\n/g, '')
          .replace(/=([a-f\d]{2})/gi, (_, pair: string) =>
            String.fromCharCode(parseInt(pair, 16)),
          );
        return new TextDecoder(charset).decode(
          Uint8Array.from(chars, (c) => c.charCodeAt(0)),
        );
      }
    } catch {
      return '';
    }
    return body;
  };
  const subject = get(header, 'Subject');
  const message = plain(header, body);
  return {
    text:
      [
        subject && !subject.startsWith('=?') ? subject : '',
        message.trim().slice(0, 6000),
      ]
        .filter(Boolean)
        .join('\n\n') ||
      '이 이메일에는 표시할 일반 텍스트가 없어요. 주문 내역 캡처를 참고해 직접 입력해 주세요.',
    file,
  };
}
