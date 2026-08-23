import { describe, it, expect } from 'vitest';
import { parsePastedOrCSVData } from '../../src/services/storage';

describe('parsePastedOrCSVData', () => {
  it('ignora linha de título antes do cabeçalho e mapeia colunas corretamente', () => {
    const raw = [
      '23/08 - DOMINGO',
      'EXPOSITOR\tX\tNOME\tCPF',
      'Empresa A\t-\tJoão Silva\t529.982.247-25',
      'Empresa B\t-\tMaria Souza\t168.995.350-09',
    ].join('\n');

    const result = parsePastedOrCSVData(raw);

    expect(result.headers).toEqual(['EXPOSITOR', 'X', 'NOME', 'CPF']);
    expect(result.attendees).toHaveLength(2);
    expect(result.attendees[0].name).toBe('João Silva');
    expect(result.attendees[0].exhibitor).toBe('Empresa A');
    expect(result.attendees[0].document).toBe('529.982.247-25');
    expect(result.attendees[1].name).toBe('Maria Souza');
    // nenhuma linha fantasma com o título
    expect(result.attendees.some((a) => a.name.includes('DOMINGO'))).toBe(false);
  });

  it('continua funcionando quando o cabeçalho está na primeira linha', () => {
    const raw = [
      'Expositor\tNome\tDocumento',
      'Empresa A\tJosé Alves\t111.444.777-35',
    ].join('\n');

    const result = parsePastedOrCSVData(raw);
    expect(result.attendees).toHaveLength(1);
    expect(result.attendees[0].name).toBe('José Alves');
  });
});
