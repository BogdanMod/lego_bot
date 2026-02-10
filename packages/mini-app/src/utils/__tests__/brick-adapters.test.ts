import { describe, it, expect } from 'vitest';
import type { BotSchema } from '@dialogue-constructor/shared/browser';
import type { BotProject } from '../../types';
import { schemaToProject, projectToSchema } from '../brick-adapters';

describe('brick-adapters', () => {
  it('converts simple schema (1 state) -> project -> schema (identical)', () => {
    const schema: BotSchema = {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: 'Hello' },
      },
    };

    const project = schemaToProject('bot1', 'Bot', schema);
    const back = projectToSchema(project);

    expect(back).toEqual(schema);
  });

  it('converts schema with menu buttons -> project with options', () => {
    const schema: BotSchema = {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: 'Start' },
        menu1: {
          message: 'Choose',
          buttons: [
            { text: 'A', nextState: 'a' },
            { text: 'B', nextState: 'b' },
          ],
        },
        a: { message: 'A' },
        b: { message: 'B' },
      },
    };

    const project = schemaToProject('bot1', 'Bot', schema);
    const menuBrick = project.bricks.find((b) => b.id === 'menu1');
    expect(menuBrick?.type).toBe('menu');
    expect(menuBrick?.options).toEqual([
      { text: 'A', targetId: 'a' },
      { text: 'B', targetId: 'b' },
    ]);
  });

  it('handles project with cyclic links', () => {
    const project: BotProject = {
      id: 'bot1',
      name: 'Bot',
      lastModified: Date.now(),
      status: 'draft',
      bricks: [
        { id: 's', type: 'start', content: 'S', nextId: 'a' },
        { id: 'a', type: 'message', content: 'A', nextId: 's' },
      ],
    };

    const schema = projectToSchema(project);
    expect(schema.version).toBe(1);
    expect(schema.initialState).toBe('s');
    expect(Object.keys(schema.states).sort()).toEqual(['a', 's']);
  });

  it('handles empty schema', () => {
    const schema = { version: 1, initialState: '', states: {} } as any as BotSchema;
    const project = schemaToProject('bot1', 'Bot', schema);
    expect(project.bricks.length).toBeGreaterThan(0);
    expect(project.bricks[0].type).toBe('start');
  });

  it('handles schema without initialState', () => {
    const schema = {
      version: 1,
      states: { a: { message: 'A' } },
    } as any as BotSchema;

    const project = schemaToProject('bot1', 'Bot', schema);
    const start = project.bricks.find((b) => b.type === 'start');
    expect(start?.id).toBe('a');
  });

  it('handles project without start brick', () => {
    const project: BotProject = {
      id: 'bot1',
      name: 'Bot',
      lastModified: Date.now(),
      status: 'draft',
      bricks: [{ id: 'a', type: 'message', content: 'A' }],
    };

    const schema = projectToSchema(project);
    expect(schema.initialState).toBe('a');
  });

  it('preserves message, parseMode, media across schema -> project -> schema', () => {
    const schema: BotSchema = {
      version: 1,
      initialState: 'start',
      states: {
        start: {
          message: 'Hello',
          parseMode: 'HTML',
          media: { type: 'photo', url: 'https://example.com/a.jpg', caption: 'cap' },
        },
      },
    };

    const project = schemaToProject('bot1', 'Bot', schema);
    const back = projectToSchema(project);
    expect(back).toEqual(schema);
  });

  it('preserves request_email type/text across schema -> project -> schema', () => {
    const schema: BotSchema = {
      version: 1,
      initialState: 'start',
      states: {
        start: {
          message: 'Start',
          buttons: [{ text: 'Go', nextState: 'email' }],
        },
        email: {
          message: 'Email',
          buttons: [{ type: 'request_email', text: 'Введите email', nextState: 'done' }],
        },
        done: { message: 'Done' },
      },
    };

    const project = schemaToProject('bot1', 'Bot', schema);
    const back = projectToSchema(project);
    expect(back).toEqual(schema);
  });

  it('preserves nextId semantics for message/start bricks via synthetic "Далее" button', () => {
    const project: BotProject = {
      id: 'bot1',
      name: 'Bot',
      lastModified: Date.now(),
      status: 'draft',
      bricks: [
        { id: 'start', type: 'start', content: 'S', nextId: 'm1' },
        { id: 'm1', type: 'message', content: 'M', nextId: 'm2' },
        { id: 'm2', type: 'message', content: 'End' },
      ],
    };

    const schema1 = projectToSchema(project);
    const project2 = schemaToProject('bot1', 'Bot', schema1);

    const start2 = project2.bricks.find((b) => b.id === 'start');
    const m12 = project2.bricks.find((b) => b.id === 'm1');

    expect(start2?.type).toBe('start');
    expect(start2?.nextId).toBe('m1');
    expect(start2?.options).toBeUndefined();

    expect(m12?.type).toBe('message');
    expect(m12?.nextId).toBe('m2');
    expect(m12?.options).toBeUndefined();

    const schema2 = projectToSchema(project2);
    expect(schema2).toEqual(schema1);
  });
});
