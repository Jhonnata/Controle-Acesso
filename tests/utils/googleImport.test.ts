import { describe, it, expect } from 'vitest';
import { isValidCPF, parseGoogleSheetsUrl, filterValidRows, diffImportedRows } from '../../src/utils/googleImport';

describe('isValidCPF', () => {
  it('aceita CPF válido com máscara', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });
  it('rejeita CPF inválido', () => {
    expect(isValidCPF('529.982.247-26')).toBe(false);
  });
  it('rejeita sequências repetidas', () => {
    expect(isValidCPF('00000000000')).toBe(false);
    expect(isValidCPF('11111111111')).toBe(false);
  });
  it('rejeita tamanho errado ou vazio', () => {
    expect(isValidCPF('')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });
});

describe('parseGoogleSheetsUrl', () => {
  it('extrai id e gid de URL padrão', () => {
    const r = parseGoogleSheetsUrl(
      'https://docs.google.com/spreadsheets/d/1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc/edit#gid=960246195'
    );
    expect(r.id).toBe('1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc');
    expect(r.gid).toBe('960246195');
  });
  it('extrai id de URL com /u/0/', () => {
    const r = parseGoogleSheetsUrl(
      'https://docs.google.com/spreadsheets/u/0/d/1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc/htmlview#gid=960246195'
    );
    expect(r.id).toBe('1XI_I53jPLb4XpRUE7wUJO1geXBfMs-OpS_3dq_Wpqhc');
    expect(r.gid).toBe('960246195');
  });
  it('retorna null para URL inválida', () => {
    const r = parseGoogleSheetsUrl('https://exemplo.com/planilha');
    expect(r.id).toBeNull();
  });
});

describe('filterValidRows', () => {
  const valid = { Nome: 'João Silva', 'Empresa/Unidade': 'Empresa A', Documento: '529.982.247-25' };
  it('mantém linha válida com cabeçalhos alternativos', () => {
    const rows = filterValidRows([valid]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cpf).toBe('52998224725');
  });
  it('remove linhas sem nome, sem empresa ou cpf inválido', () => {
    const rows = filterValidRows([
      valid,
      { ...valid, Nome: '' },
      { ...valid, Empresa: undefined, 'Empresa/Unidade': '' },
      { ...valid, Documento: '12345678901' },
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe('diffImportedRows', () => {
  it('separa existentes de novos por CPF', () => {
    const existing = [{ document: '529.982.247-25' }];
    const incoming = [
      { cpf: '52998224725', nome: 'A' },
      { cpf: '16899535009', nome: 'B' },
    ];
    const { existingMatches, newRows } = diffImportedRows(existing as any, incoming, ['cpf']);
    expect(existingMatches).toHaveLength(1);
    expect(newRows).toHaveLength(1);
    expect(newRows[0].nome).toBe('B');
  });
});
