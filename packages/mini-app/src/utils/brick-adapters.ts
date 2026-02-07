import type { BotSchema, BotButton, MediaContent, MediaGroupItem, WebhookConfig, IntegrationTemplate } from '@dialogue-constructor/shared/browser';
import type { BotProject, Brick, MenuOption } from '../types';

type BrickExtras = {
  // Preserve optional BotSchema state fields across roundtrips where possible.
  media?: MediaContent;
  mediaGroup?: MediaGroupItem[];
  parseMode?: BotSchema['states'][string]['parseMode'];
  webhook?: WebhookConfig;
  integration?: IntegrationTemplate;
  requestButtonType?: 'request_contact' | 'request_email';
  requestButtonText?: string;
};

type BrickWithExtras = Brick & BrickExtras;

function generateId(prefix = 'brick'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isButtonWithNextState(button: BotButton): button is Extract<BotButton, { nextState: string }> {
  return typeof (button as any)?.nextState === 'string';
}

function collectNextStatesFromButtons(buttons: BotButton[] | undefined): string[] {
  if (!buttons || buttons.length === 0) return [];
  const nexts: string[] = [];
  for (const b of buttons) {
    if (isButtonWithNextState(b)) nexts.push(b.nextState);
  }
  return nexts;
}

function hasRequestInputButton(buttons: BotButton[] | undefined): boolean {
  if (!buttons) return false;
  return buttons.some((b) => (b as any)?.type === 'request_contact' || (b as any)?.type === 'request_email');
}

function syntheticNextIdFromButtons(buttons: BotButton[] | undefined): string | undefined {
  if (!buttons || buttons.length !== 1) return undefined;
  const b: any = buttons[0] as any;
  if (!b) return undefined;
  if (b.type === 'request_contact' || b.type === 'request_email' || b.type === 'url') return undefined;
  if (typeof b.text !== 'string' || b.text !== 'Далее') return undefined;
  if (typeof b.nextState !== 'string') return undefined;
  return b.nextState;
}

function firstRequestInputButton(
  buttons: BotButton[] | undefined
): { type: 'request_contact' | 'request_email'; text: string; nextState: string } | undefined {
  if (!buttons) return undefined;
  for (const b of buttons) {
    const t = (b as any)?.type;
    if ((t === 'request_contact' || t === 'request_email') && typeof (b as any)?.nextState === 'string') {
      return {
        type: t,
        text: typeof (b as any)?.text === 'string' ? (b as any).text : '',
        nextState: (b as any).nextState,
      };
    }
  }
  return undefined;
}

function buttonsToMenuOptions(buttons: BotButton[] | undefined): MenuOption[] | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  const opts: MenuOption[] = [];
  for (const b of buttons) {
    if (isButtonWithNextState(b)) {
      opts.push({ text: b.text, targetId: b.nextState });
      continue;
    }
    // UrlButton (or unknown) cannot be represented in MenuOption.
    if ((b as any)?.type === 'url') {
      console.warn('[brick-adapters] UrlButton cannot be represented in MenuOption; dropping url for:', b.text);
      opts.push({ text: b.text });
      continue;
    }
    console.warn('[brick-adapters] Button without nextState cannot be represented; dropping targetId for:', (b as any)?.text);
    opts.push({ text: (b as any)?.text ?? '' });
  }
  return opts.length > 0 ? opts : undefined;
}

function buildTraversalOrder(schema: any, startKey: string): string[] {
  const states: Record<string, any> = schema?.states || {};
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  const visit = (key: string) => {
    if (!key) return;
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      console.warn('[brick-adapters] Cyclic reference detected while traversing schema at state:', key);
      return;
    }

    if (!states[key]) {
      console.warn('[brick-adapters] nextState references missing state; ignoring:', key);
      return;
    }

    visiting.add(key);
    visited.add(key);
    order.push(key);

    const nexts = collectNextStatesFromButtons(states[key]?.buttons);
    for (const n of nexts) {
      visit(n);
    }

    visiting.delete(key);
  };

  visit(startKey);

  // Ensure we "обойти все states" even if some are disconnected.
  for (const key of Object.keys(states)) {
    if (!visited.has(key)) order.push(key);
  }

  return order;
}

export function schemaToProject(botId: string, name: string, schema: BotSchema): BotProject {
  const anySchema: any = schema as any;
  const states: Record<string, any> = anySchema?.states || {};
  const stateKeys = Object.keys(states);

  const initialState: string | undefined =
    typeof anySchema?.initialState === 'string' && anySchema.initialState.trim().length > 0
      ? anySchema.initialState
      : undefined;

  // Edge case: empty schema or no states.
  if (!stateKeys || stateKeys.length === 0) {
    const startBrick: BrickWithExtras = {
      id: generateId('start'),
      type: 'start',
      content: '',
    };
    return {
      id: botId,
      name,
      bricks: [startBrick],
      lastModified: Date.now(),
      status: 'draft',
    };
  }

  const startKey = initialState ?? stateKeys[0];
  if (!initialState) {
    console.warn('[brick-adapters] Schema missing initialState; using first state as start:', startKey);
  }

  const order = buildTraversalOrder(anySchema, startKey);

  const bricks: BrickWithExtras[] = [];
  for (const key of order) {
    const state = states[key];
    if (!state) continue;

    const buttons: BotButton[] | undefined = state.buttons;
    const isStart = key === startKey;
    const isInput = hasRequestInputButton(buttons);
    const syntheticNextId = syntheticNextIdFromButtons(buttons);

    const brick: BrickWithExtras = {
      id: key,
      type: isStart ? 'start' : isInput ? 'input' : syntheticNextId ? 'message' : buttons && buttons.length > 0 ? 'menu' : 'message',
      content: state.message ?? '',
    };

    // Preserve optional state fields for roundtrip.
    if (state.media) brick.media = state.media;
    if (state.mediaGroup) brick.mediaGroup = state.mediaGroup;
    if (state.parseMode) brick.parseMode = state.parseMode;
    if (state.webhook) brick.webhook = state.webhook;
    if (state.integration) brick.integration = state.integration;

    if (brick.type === 'input') {
      const req = firstRequestInputButton(buttons);
      if (req) {
        brick.nextId = req.nextState;
        brick.requestButtonType = req.type;
        brick.requestButtonText = req.text;
      }
    }

    if ((brick.type === 'message' || brick.type === 'start') && !isInput && syntheticNextId) {
      brick.nextId = syntheticNextId;
    }

    if ((brick.type === 'menu' || brick.type === 'start') && buttons && buttons.length > 0 && !isInput && !syntheticNextId) {
      brick.options = buttonsToMenuOptions(buttons);
    }

    // Validate references (warn-only).
    if (brick.nextId && !states[brick.nextId]) {
      console.warn('[brick-adapters] nextId references missing state; ignoring:', brick.nextId);
      delete brick.nextId;
    }
    if (brick.options) {
      for (const opt of brick.options) {
        if (opt.targetId && !states[opt.targetId]) {
          console.warn('[brick-adapters] targetId references missing state; ignoring:', opt.targetId);
          delete opt.targetId;
        }
      }
    }

    bricks.push(brick);
  }

  return {
    id: botId,
    name,
    bricks,
    lastModified: Date.now(),
    status: 'draft',
  };
}

export function projectToSchema(project: BotProject): BotSchema {
  const bricks = Array.isArray(project?.bricks) ? project.bricks : [];

  if (bricks.length === 0) {
    console.warn('[brick-adapters] Project has no bricks; returning default schema');
    return {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: '' },
      },
    };
  }

  let startBrick = bricks.find((b) => b.type === 'start');
  if (!startBrick) {
    console.warn('[brick-adapters] Project missing start brick; using first brick as start');
    startBrick = bricks[0];
  }

  const ids = new Set(bricks.map((b) => b.id));

  const states: BotSchema['states'] = {};
  for (const b of bricks) {
    const brick = b as BrickWithExtras;
    const state: any = {
      message: brick.content ?? '',
    };

    if (brick.media) state.media = brick.media;
    if (brick.mediaGroup) state.mediaGroup = brick.mediaGroup;
    if (brick.parseMode) state.parseMode = brick.parseMode;
    if (brick.webhook) state.webhook = brick.webhook;
    if (brick.integration) state.integration = brick.integration;

    if (brick.type === 'menu' || (brick.type === 'start' && Array.isArray(brick.options) && brick.options.length > 0)) {
      const buttons: any[] = [];
      for (const opt of brick.options || []) {
        if (!opt.targetId) {
          console.warn('[brick-adapters] MenuOption missing targetId; ignoring option:', opt.text);
          continue;
        }
        if (!ids.has(opt.targetId)) {
          console.warn('[brick-adapters] MenuOption targetId missing in project; ignoring:', opt.targetId);
          continue;
        }
        buttons.push({ text: opt.text, nextState: opt.targetId });
      }
      if (buttons.length > 0) state.buttons = buttons;
    } else if (brick.type === 'input') {
      if (brick.nextId && ids.has(brick.nextId)) {
        const type = brick.requestButtonType || 'request_contact';
        const text = brick.requestButtonText || 'Поделиться контактом';
        state.buttons = [{ type, text, nextState: brick.nextId }];
      } else if (brick.nextId) {
        console.warn('[brick-adapters] Input brick nextId missing in project; ignoring:', brick.nextId);
      }
    } else if (brick.type === 'message' || brick.type === 'start') {
      if (brick.nextId) {
        if (ids.has(brick.nextId)) {
          state.buttons = [{ text: 'Далее', nextState: brick.nextId }];
        } else {
          console.warn('[brick-adapters] nextId missing in project; ignoring:', brick.nextId);
        }
      }
    }

    states[brick.id] = state;
  }

  return {
    version: 1,
    initialState: startBrick.id,
    states,
  };
}
