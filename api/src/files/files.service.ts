import { Injectable } from '@nestjs/common';
import { rm, stat } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { notFound } from '../common/errors';

@Injectable()
export class FilesService {
  private get root() {
    return resolve(process.env.DATA_DIR ?? '/data');
  }

  async resolveFile(rel: string): Promise<string> {
    if (rel.split(/[\\/]/).includes('..') || rel.includes('\0')) throw notFound('Arquivo');
    const abs = resolve(this.root, rel);
    if (!abs.startsWith(this.root + sep)) throw notFound('Arquivo');
    const s = await stat(abs).catch(() => null);
    if (!s?.isFile()) throw notFound('Arquivo');
    return abs;
  }

  removePlotDirs(plotIds: string[]) {
    return Promise.all(plotIds.map((id) => rm(join(this.root, 'plots', id), { recursive: true, force: true })));
  }
}
