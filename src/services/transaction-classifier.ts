import { KNOWN_ROUTERS, METHOD_SIGNATURES, FACTORY_ADDRESSES } from './dex-contracts';
import { createLogger } from './logger';

const logger = createLogger('TransactionClassifier');

export interface ClassificationResult {
  type: string;
  confidence: number;
  methodSignature: string | null;
  routerAddress: string | null;
  tokensInvolved: string[];
  metadata: Record<string, unknown>;
}

export class TransactionClassifier {
  classifyTransaction(
    to: string | null,
    data: string
  ): ClassificationResult {
    if (!to) {
      return this.classifyContractDeploy(data);
    }

    const normalizedTo = to.toLowerCase();
    const methodSig = data.slice(0, 10);

    if (KNOWN_ROUTERS[normalizedTo]) {
      return this.classifyDexTransaction(normalizedTo, methodSig, data);
    }

    if (FACTORY_ADDRESSES[normalizedTo]) {
      return this.classifyFactoryTransaction(normalizedTo, methodSig, data);
    }

    return this.classifyByMethodSignature(methodSig, data);
  }

  private classifyContractDeploy(data: string): ClassificationResult {
    const isContractCreation = data.length > 10 && data.startsWith('0x60806040');

    return {
      type: 'contract_deploy',
      confidence: isContractCreation ? 0.95 : 0.85,
      methodSignature: data.slice(0, 10),
      routerAddress: null,
      tokensInvolved: [],
      metadata: {
        bytecodeLength: data.length,
        likelyConstructor: isContractCreation,
      },
    };
  }

  private classifyDexTransaction(
    routerAddress: string,
    methodSig: string,
    data: string
  ): ClassificationResult {
    const routerInfo = KNOWN_ROUTERS[routerAddress];
    const methodInfo = METHOD_SIGNATURES[methodSig];

    if (!methodInfo) {
      logger.debug('Unknown method on known DEX router', {
        router: routerInfo.name,
        methodSig,
      });

      return {
        type: 'unknown',
        confidence: 0.3,
        methodSignature: methodSig,
        routerAddress,
        tokensInvolved: this.extractTokenAddresses(data),
        metadata: {
          router: routerInfo.name,
          chain: routerInfo.chain,
        },
      };
    }

    return {
      type: methodInfo.type,
      confidence: 0.9,
      methodSignature: methodSig,
      routerAddress,
      tokensInvolved: this.extractTokenAddresses(data),
      metadata: {
        method: methodInfo.name,
        router: routerInfo.name,
        chain: routerInfo.chain,
      },
    };
  }

  private classifyFactoryTransaction(
    factoryAddress: string,
    methodSig: string,
    data: string
  ): ClassificationResult {
    const factoryName = FACTORY_ADDRESSES[factoryAddress];
    const methodInfo = METHOD_SIGNATURES[methodSig];

    return {
      type: methodInfo?.type || 'create_pair',
      confidence: 0.85,
      methodSignature: methodSig,
      routerAddress: null,
      tokensInvolved: this.extractTokenAddresses(data),
      metadata: {
        factory: factoryName,
        method: methodInfo?.name || 'Unknown',
      },
    };
  }

  private classifyByMethodSignature(
    methodSig: string,
    data: string
  ): ClassificationResult {
    const methodInfo = METHOD_SIGNATURES[methodSig];

    if (!methodInfo) {
      return {
        type: 'unknown',
        confidence: 0.2,
        methodSignature: methodSig,
        routerAddress: null,
        tokensInvolved: [],
        metadata: {
          reason: 'Unknown method signature',
        },
      };
    }

    return {
      type: methodInfo.type,
      confidence: 0.6,
      methodSignature: methodSig,
      routerAddress: null,
      tokensInvolved: this.extractTokenAddresses(data),
      metadata: {
        method: methodInfo.name,
      },
    };
  }

  private extractTokenAddresses(data: string): string[] {
    const tokens: string[] = [];
    const addressPattern = /[0-9a-f]{64}/gi;
    const matches = data.match(addressPattern);

    if (matches) {
      for (const match of matches) {
        const address = '0x' + match.slice(-40);

        if (address !== '0x0000000000000000000000000000000000000000' &&
            !tokens.includes(address)) {
          tokens.push(address.toLowerCase());
        }
      }
    }

    return tokens.slice(0, 5);
  }

  getHotTransactionScore(classification: ClassificationResult): number {
    const typeScores: Record<string, number> = {
      contract_deploy: 10,
      add_liquidity: 9,
      create_pair: 9,
      token_mint: 8,
      swap: 5,
      token_transfer: 2,
      token_approval: 1,
      unknown: 0,
    };

    const baseScore = typeScores[classification.type] || 0;
    const confidenceMultiplier = classification.confidence;
    const routerBonus = classification.routerAddress ? 1.5 : 1.0;

    return baseScore * confidenceMultiplier * routerBonus;
  }
}
