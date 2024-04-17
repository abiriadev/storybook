/* eslint-disable no-underscore-dangle */
import type { CoreConfig } from '@storybook/types';
import type { Channel } from '@storybook/channels';
import type { SaveStoryPayload, SaveStoryResponse } from '@storybook/core-events';
import { SAVE_STORY_REQUEST, SAVE_STORY_RESULT } from '@storybook/core-events';
import type { OptionsWithRequiredCache } from '../whats-new';
import { readCsf, writeCsf } from '@storybook/csf-tools';
import { join } from 'path';
import { updateArgsInCsfFile } from './update-args-in-csf-file';
import { duplicateStoryWithNewName } from './duplicate-story-with-new-name';
// import { sendTelemetryError } from '../withTelemetry';

export function initializeSaveFromControls(
  channel: Channel,
  options: OptionsWithRequiredCache,
  coreOptions: CoreConfig
) {
  channel.on(SAVE_STORY_REQUEST, async (data: SaveStoryPayload) => {
    const id = data.id.split('--')[1];
    try {
      const location = join(process.cwd(), data.importPath);

      // open the story file
      const csf = await readCsf(location, {
        makeTitle: (userTitle: string) => userTitle,
      });

      const parsed = csf.parse();

      // find the export_name for the id
      const [name] =
        Object.entries(parsed._stories).find(([_, value]) => value.id.endsWith(`--${id}`)) || [];

      let node;

      if (!name) {
        throw new Error(`no story found with id: ${id}`);
      }

      // find the AST node for the export_name, if none can be found, create a new story
      if (data.name) {
        node = duplicateStoryWithNewName(parsed, name, data.name);
      } else {
        node = csf.getStoryExport(name);
      }

      // modify the AST node with the new args
      updateArgsInCsfFile(node, data.args);

      // save the file
      await writeCsf(csf, location);

      channel.emit(SAVE_STORY_RESULT, {
        id: data.id,
        success: true,
        error: null,
      } satisfies SaveStoryResponse);
    } catch (e: any) {
      // sendTelemetryError(channel, e);
      channel.emit(SAVE_STORY_RESULT, {
        id: data.id,
        success: false,
        error: `writing to CSF-file failed, is it a valid CSF-file?`,
      } satisfies SaveStoryResponse);

      console.error(e.stack || e.message || e.toString());
    }
  });
}
