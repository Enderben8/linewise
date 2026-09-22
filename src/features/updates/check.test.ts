/**
 * @jest-environment node
 */
import { APP } from '../../config';
import { checkForUpdate } from './check';

const release = {
  tag_name: 'v9.0.0',
  html_url: `${APP.releasesSite}tag/v9.0.0`,
  assets: [
    {
      name: 'linewise-v9.0.0.apk',
      browser_download_url: `${APP.releasesSite}download/v9.0.0/linewise-v9.0.0.apk`,
    },
  ],
};

afterEach(() => jest.restoreAllMocks());

describe('checkForUpdate', () => {
  it('asks GitHub for the latest release and offers a newer one', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => release } as Response);
    await expect(checkForUpdate('1.0.0')).resolves.toEqual({
      version: '9.0.0',
      url: `${APP.releasesSite}download/v9.0.0/linewise-v9.0.0.apk`,
    });
    expect(fetchMock).toHaveBeenCalledWith(APP.releasesApiUrl, expect.anything());
  });

  it('resolves null when this is the newest version', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => release } as Response);
    await expect(checkForUpdate('9.0.0')).resolves.toBeNull();
  });

  it('rejects when GitHub cannot be reached, so the caller can stay quiet or say so', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(checkForUpdate('1.0.0')).rejects.toThrow('403');

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network request failed'));
    await expect(checkForUpdate('1.0.0')).rejects.toThrow('Network request failed');
  });
});
