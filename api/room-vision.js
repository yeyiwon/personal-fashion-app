// Native Vision runs on the user's Mac. A cloud preview never receives photo data on this endpoint.
import { reply } from '../server/room-http.js';
export default (req, res) =>
  reply(res, req.method === 'GET' ? 200 : 503, {
    available: false,
    error: '이 환경은 Mac 기기 내 인식을 지원하지 않아요.',
  });
