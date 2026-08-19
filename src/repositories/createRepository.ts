import { read, write } from './storage';

/** Contrato de leitura e escrita de uma coleção ou singleton persistido. */
export interface Repository<T> {
  key: string;
  load: () => T;
  save: (value: T) => void;
}

/** Transformação aplicada no carregamento, com acesso à escrita para persistir migrações. */
export type Loader<T> = (data: T, persist: (value: T) => void) => T;

// Factory única para coleções (arrays) e singletons (objetos de configuração).
//
// Nota sobre o plano: a F0-12 previa duas factories separadas — createCollectionRepository e
// createSingletonRepository. Na implementação elas resultariam em código idêntico (load/save
// sobre uma chave, com seed de fallback); a única diferença seria o formato do seed. Manter
// duas funções iguais seria duplicação sem ganho, então há uma factory e a distinção de intenção
// fica nos nomes das instâncias em index.js.
//
// `loader` opcional permite que uma coleção aplique transformações no carregamento
// (usado por monitorings, que migra dados de versões anteriores).
export const createRepository = <T,>(key: string, seed: T, loader: Loader<T> | null = null): Repository<T> => ({
  key,
  load: () => {
    const data = read(key, seed);
    return loader ? loader(data, (value) => write(key, value)) : data;
  },
  save: (value) => write(key, value),
});
