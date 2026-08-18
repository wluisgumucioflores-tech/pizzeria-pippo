import { OpenAiCompatibleProviderClient } from './openai-compatible-provider.client';

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

describe('OpenAiCompatibleProviderClient', () => {
  let client: OpenAiCompatibleProviderClient;

  beforeEach(() => {
    mockCreate.mockReset();
    client = new OpenAiCompatibleProviderClient();
  });

  it('devuelve el contenido del primer choice, recortado', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '  hola  ' } }],
    });

    const result = await client.complete(
      { apiKey: 'key', model: 'qwen-plus', baseURL: 'https://example.com' },
      'system',
      [{ role: 'user', content: 'hola' }],
    );

    expect(result).toEqual({ type: 'text', content: 'hola' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'hola' },
        ],
      }),
    );
  });

  it('devuelve string vacío si no hay choices', async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await client.complete(
      { apiKey: 'key', model: 'qwen-plus' },
      'system',
      [{ role: 'user', content: 'hola' }],
    );

    expect(result).toEqual({ type: 'text', content: '' });
  });

  it('devuelve tool_calls cuando el modelo pide llamar una tool', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'get_stock_alerts',
                  arguments: '{"branch_id":"b1"}',
                },
              },
            ],
          },
        },
      ],
    });

    const result = await client.complete(
      { apiKey: 'key', model: 'qwen-plus' },
      'system',
      [{ role: 'user', content: 'hay poco stock?' }],
      [
        {
          name: 'get_stock_alerts',
          description: 'alertas de stock',
          inputSchema: {},
        },
      ],
    );

    expect(result).toEqual({
      type: 'tool_calls',
      calls: [
        {
          id: 'call_1',
          name: 'get_stock_alerts',
          arguments: { branch_id: 'b1' },
        },
      ],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_stock_alerts',
              description: 'alertas de stock',
              parameters: {},
            },
          },
        ],
      }),
    );
  });

  it('mapea un mensaje de rol tool a role: tool con tool_call_id', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'listo' } }],
    });

    await client.complete({ apiKey: 'key', model: 'qwen-plus' }, 'system', [
      { role: 'user', content: 'hay poco stock?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_1', name: 'get_stock_alerts', arguments: {} }],
      },
      { role: 'tool', content: 'sin alertas', toolCallId: 'call_1' },
    ]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'hay poco stock?' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'get_stock_alerts', arguments: '{}' },
              },
            ],
          },
          { role: 'tool', tool_call_id: 'call_1', content: 'sin alertas' },
        ],
      }),
    );
  });
});
