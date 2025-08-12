import { Logger } from 'winston';
import { z } from 'zod';
import { exitProcess } from './util';

export class ConfigurationLoader {
  readonly configuration!: Configuration;

  private readonly boolean = () => z.preprocess((v) => v === 'true' || v === true, z.boolean());

  private readonly degiroCredentialsSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    totpSeed: z.string().optional(),
  });

  private readonly productSchema = z.object({
    symbol: z.string().min(1),
    isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, { message: 'Invalid ISIN format' }),
    ratio: z.coerce.number().min(1),
    exchange: z.coerce.number().min(1),
  });

  private readonly configurationSchema = z.object({
    credentials: this.degiroCredentialsSchema,
    minCashInvest: z.coerce.number().min(1).default(100),
    maxCashInvest: z.coerce.number().min(1).default(2000),
    maxFeePercentage: z.coerce.number().nonnegative().optional(),
    cashCurrency: z.string().length(3).default('EUR'),
    allowOpenOrders: this.boolean().default(false),
    useLimitOrder: this.boolean().default(true),
    portfolio: z.array(this.productSchema).min(1),
    schedule: z.string().default('0 12 * * *'),
    buyOnLaunch: this.boolean().default(false),
    dryRun: this.boolean().default(true),
  });

  constructor(private logger: Logger) {
    try {
      this.configuration = this.loadConfiguration();
    } catch (e) {
      exitProcess(this.logger, e);
    }
  }

  private loadConfiguration(): Configuration {
    // Collect PRODUCT_<SYMBOL>_<FIELD> entries into objects with raw string values
    const productsMap = new Map<string, Record<string, unknown>>();

    for (const [k, v] of Object.entries(process.env)) {
      if (!k.startsWith('PRODUCT_') || !v) continue;
      const m = k.match(/^PRODUCT_([^_]+)_(.+)$/i);
      if (!m) continue;
      const [, symbol, field] = m;
      const entry = productsMap.get(symbol) ?? { symbol };
      entry[field.toLowerCase()] = v;
      productsMap.set(symbol, entry);
    }

    const portfolio = Array.from(productsMap.values());

    // Assemble raw configuration object from environment variables
    const rawConfiguration = {
      credentials: {
        username: process.env.DEGIRO_USERNAME,
        password: process.env.DEGIRO_PASSWORD,
        totpSeed: process.env.DEGIRO_TOTP_SEED,
      },
      minCashInvest: process.env.MIN_CASH_INVEST,
      maxCashInvest: process.env.MAX_CASH_INVEST,
      maxFeePercentage: process.env.MAX_FEE_PERCENTAGE,
      cashCurrency: process.env.CASH_CURRENCY,
      allowOpenOrders: process.env.ALLOW_OPEN_ORDERS,
      useLimitOrder: process.env.USE_LIMIT_ORDER,
      portfolio,
      schedule: process.env.SCHEDULE,
      buyOnLaunch: process.env.BUY_ON_LAUNCH,
      dryRun: process.env.DRY_RUN,
    };

    // Check configuration against schema
    const configuration = this.configurationSchema.parse(rawConfiguration) as Configuration;

    // Log configuration
    const secret = '*****';
    const logConfiguration = {
      ...configuration,
      credentials: {
        username: secret,
        password: secret,
        ...(configuration.credentials.totpSeed && { totpSeed: secret }),
      },
    };
    this.logger.debug('Loaded configuration: ' + JSON.stringify(logConfiguration, null, 2));

    // Return validated configuration for use
    return configuration;
  }
}

export interface Configuration {
  credentials: Credentials;
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
