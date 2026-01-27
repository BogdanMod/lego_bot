import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { sendTelegramMessage, sendVideo, buildVideoOptionsForSdk } from '../telegram';

vi.mock('axios', () => {
  const post = vi.fn();
  return {
    default: { post },
    post,
    isAxiosError: () => false,
  };
});

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
} as any;

describe('telegram formatting', () => {
  it('escapes MarkdownV2 and sends parse_mode', async () => {
    const postMock = axios.post as unknown as ReturnType<typeof vi.fn>;
    postMock.mockClear();
    postMock.mockResolvedValueOnce({
      data: { ok: true, result: { message_id: 1 } },
    });

    await sendTelegramMessage(
      logger,
      'token',
      1,
      'Hello _world_!',
      'MarkdownV2'
    );

    const payload = postMock.mock.calls[0][1];
    expect(payload.parse_mode).toBe('MarkdownV2');
    expect(payload.text).toBe('Hello \\_world\\_\\!');
  });

  it('sends video cover via Bot API cover field', async () => {
    const postMock = axios.post as unknown as ReturnType<typeof vi.fn>;
    postMock.mockClear();
    postMock.mockResolvedValueOnce({
      data: { ok: true, result: { message_id: 1 } },
    });

    await sendVideo(
      logger,
      'token',
      1,
      'https://example.com/video.mp4',
      'Caption',
      'HTML',
      'https://example.com/cover.jpg',
      undefined,
      'attach://thumb'
    );

    const payload = postMock.mock.calls[0][1];
    expect(payload.cover).toBe('https://example.com/cover.jpg');
    expect(payload.thumbnail).toBe('attach://thumb');
    expect(payload.thumb).toBeUndefined();
  });

  it('adds thumb alias for SDK-style options when thumbnail is attach', () => {
    const options = buildVideoOptionsForSdk(
      'Caption',
      'HTML',
      'https://example.com/cover.jpg',
      'attach://thumb',
      { inline_keyboard: [] }
    );
    expect(options.cover).toBe('https://example.com/cover.jpg');
    expect(options.thumbnail).toBe('attach://thumb');
    expect(options.thumb).toBe('attach://thumb');
  });
});
