import { Logger } from 'pino';
import { z } from 'zod';
import { exit } from './util';

export class ConfigurationLoader {
  readonly configuration!: Configuration;

  private readonly boolean = () => z.preprocess((v) => v === 'true' || v === true, z.boolean());

  private readonly toCamelCase = (object: Record<string, unknown>): Record<string, unknown> => {
    const keyToCamelCase = (key: string) => key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const map: Record<string, unknown> = {};
    for (const key in object) {
      map[keyToCamelCase(key)] = object[key];
    }
    return map;
  };

  private readonly productSchema = z
    .object({
      SYMBOL: z.string().min(1),
      ISIN: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, { error: 'Invalid ISIN format' }),
      RATIO: z.coerce.number().min(1),
      EXCHANGE: z.coerce.number().min(1),
    })
    .transform((object) => this.toCamelCase(object) as unknown as Product);

  private readonly configurationSchema = z
    .object({
      DEGIRO_USERNAME: z.string().min(1),
      DEGIRO_PASSWORD: z.string().min(1),
      DEGIRO_TOTP_SEED: z.string().optional(),
      MIN_CASH_INVEST: z.coerce.number().min(1).default(100),
      MAX_CASH_INVEST: z.coerce.number().min(1).default(2000),
      MAX_FEE_PERCENTAGE: z.coerce.number().nonnegative().optional(),
      CASH_CURRENCY: z.string().length(3).default('EUR'),
      ALLOW_OPEN_ORDERS: this.boolean().default(false),
      USE_LIMIT_ORDER: this.boolean().default(true),
      PORTFOLIO: z.array(this.productSchema).min(1),
      SCHEDULE: z.string().default('0 12 * * *'),
      BUY_ON_LAUNCH: this.boolean().default(false),
      DRY_RUN: this.boolean().default(true),
    })
    .transform((object) => this.toCamelCase(object) as unknown as Configuration);

  constructor(private logger: Logger) {
    try {
      this.configuration = this.loadConfiguration();
    } catch (e) {
      exit(this.logger, e);
    }
  }

  private loadConfiguration(): Configuration {
    // Collect PRODUCT_<SYMBOL>_<FIELD> entries into objects with raw string values
    const productsMap = new Map<string, Record<string, unknown>>();
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith('PRODUCT_') || !value) continue;
      const match = key.match(/^PRODUCT_([^_]+)_(.+)$/i);
      if (!match) continue;
      const [, SYMBOL, field] = match;
      const entry = productsMap.get(SYMBOL) ?? { SYMBOL };
      entry[field] = value;
      productsMap.set(SYMBOL, entry);
    }
    const PORTFOLIO = Array.from(productsMap.values());

    // Check configuration against schema
    const result = this.configurationSchema.safeParse({ ...process.env, PORTFOLIO });

    if (result.error) {
      const error = `Invalid configuration:\n${z.prettifyError(result.error)}`;
      exit(this.logger, new Error(error));
    }

    const configuration: Configuration = result.data!;

    // Log configuration
    const secret = '*****';
    const logConfiguration = {
      ...configuration,
      degiroUsername: secret,
      degiroPassword: secret,
      ...(configuration.degiroTotpSeed && { totpSeed: secret }),
    };
    this.logger.debug('Loaded configuration: ' + JSON.stringify(logConfiguration, null, 2));

    // Return validated configuration for use
    return configuration;
  }
}

export interface Configuration {
  degiroUsername: string;
  degiroPassword: string;
  degiroTotpSeed: string;
  minCashInvest: number;
  maxCashInvest: number;
  maxFeePercentage?: number;
  cashCurrency: string;
  allowOpenOrders: boolean;
  useLimitOrder: boolean;
  portfolio: Product[];
  schedule: string;
  buyOnLaunch: boolean;
  dryRun: boolean;
}

export interface Product {
  symbol: string;
  isin: string;
  ratio: number;
  exchange: number;
}

export interface Credentials {
  username: string;
  password: string;
  totpSeed?: string;
}
