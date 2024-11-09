import { FetchRequest, ofetch } from 'ofetch';
type AnyJSON = AnyJSON[] | { [key: string]: AnyJSON } | string | number | boolean | null;

export type UntiePayload = {
  identity: string,
  args: AnyJSON[]
}

export interface UntieTransporter {
  send(untie: Untie, payload: UntiePayload): Promise<AnyJSON>;
}

export class NodeFetchTransporter implements UntieTransporter {
  #requestInfo: {
    url: string,
    method: string,
  }
  constructor(requestInfo: {
    url: string,
    method: string,
  }) {
    this.#requestInfo = requestInfo;
  }
  async send(untie, payload: UntiePayload) {
    const response = await ofetch<AnyJSON>(this.#requestInfo.url, {
      method: this.#requestInfo.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': untie.settings.secret,
      },
      body: JSON.stringify(payload)
    });

    return response
  }
}

export class Untie {
  functions: Map<string, CallableFunction> = new Map();

  constructor(public settings: {
    remoteMode: boolean,
    receiver: boolean,
    secret: string,
    transporter?: UntieTransporter
  }) {

    if (!settings.remoteMode) {
      return
    }

    if (!settings.transporter && !settings.receiver) {
      throw new Error('You initialized the local untie in remote mode without a transporter');
    }

    if (!settings.secret) {
      throw new Error('You must provide a secret');
    }

  }

  async injest(credentials: string, input: UntiePayload) {

    console.log('injest', credentials, "===", this.settings.secret)

    if (credentials !== this.settings.secret) {
      throw new Error('Invalid credentials');
    }

    const payload = input as UntiePayload;
    return this.invoke(payload);
  }

  async invokeRemotely(payload: UntiePayload) {
    const response = await this.settings.transporter.send(this, payload);
    return response
  }

  async invokeLocally(payload: UntiePayload) {
    const fn = this.functions.get(payload.identity);

    if (!fn) {
      throw new Error('Function not found');
    }
    try {
      return fn(...payload.args);
    } catch (e) {
      return {
        error: e
      }
    }
  }

  async invoke(payload: UntiePayload) {
    if (!isSafelySerializable(payload.args)) {
      throw new Error('Arguments are not safely serializable');
    }

    if (this.settings.remoteMode && !this.settings.receiver) {
      return this.invokeRemotely(payload);
    }

    return this.invokeLocally(payload);
  }

  fn<T extends (...AnyTodo) => AnyTodo>(fn: T, settings: { key?: string } = {}) {

    const identity = settings.key || fn.name || fn.toString();

    if (!identity) {
      throw new Error('We could not infer a key for this function. You should provide one');
    }

    if (this.functions.has(identity)) {
      throw new Error('This function is already wrapped');
    }

    this.functions.set(identity, fn);

    const wrappedFunction = async (...args: Parameters<T>) => {
      const result = await this.invoke({
        identity,
        args: args,
      });

      if (result.error) {
        const error = new Error(result.error.message);
        throw error;
      }

      return result;
    };

    return wrappedFunction as unknown as T
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type AnyTodo = any

const isSafelySerializable = (input: AnyTodo[]): boolean => {
  // detect if input is safely serializable
  try {
    JSON.stringify(input);
    return true;
  } catch (e) {
    return false;
  }
}

export const defineUntiedFunction = <T extends AnyTodo>(untieInstance: Untie, fn: T, settings: { key?: string } = {}) => {
  return untieInstance.fn(fn as AnyTodo, settings) as unknown as T;
}