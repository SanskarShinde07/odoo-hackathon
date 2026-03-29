import axios from "axios";

const COUNTRIES_API = "https://restcountries.com/v3.1/all?fields=name,currencies";
const EXCHANGE_API = "https://api.exchangerate-api.com/v4/latest";

export interface CountryCurrencyInfo {
  name: string;
  currencies: Record<string, { name: string; symbol: string }>;
}

// Fetch all countries with their currencies from restcountries API
export const fetchCountriesWithCurrencies =
  async (): Promise<CountryCurrencyInfo[]> => {
    const { data } = await axios.get<
      { name: { common: string }; currencies: Record<string, { name: string; symbol: string }> }[]
    >(COUNTRIES_API);

    return data.map((c) => ({
      name: c.name.common,
      currencies: c.currencies || {},
    }));
  };

// Convert an amount from one currency to another
export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; rate: number }> => {
  const { data } = await axios.get<{
    rates: Record<string, number>;
    base: string;
  }>(`${EXCHANGE_API}/${fromCurrency.toUpperCase()}`);

  const rate = data.rates[toCurrency.toUpperCase()];
  if (!rate) {
    throw new Error(
      `Currency code "${toCurrency}" not found in exchange rates`
    );
  }

  return {
    convertedAmount: parseFloat((amount * rate).toFixed(2)),
    rate,
  };
};
