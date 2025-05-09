function getPriceFromStark({
  SKU,
  isPristine,
  isPadding,
  widthInches,
  LengthInches,
  BindingMethod,
}) {
  var payload = JSON.stringify({
    SKU: SKU,
    BindingMethod: BindingMethod,
    WidthInInches: widthInches,
    LengthInInches: LengthInches,
    IsPristineTreatment: isPristine,
    IsAddingPadding: isPadding,
  });

  var requestOptions = {
    method: "POST",
    body: payload,
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
    },
  };

  return fetch(
    "https://pmapapi.prestigemills.com/ViewItem/RugCalculation",
    requestOptions
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const retailCharge =
        data.CalculationCharge?.RetailCharge?.CarpetCharge || 0;
      const fabricationCharge =
        data.CalculationCharge?.RetailCharge?.FabricationCharge || 0;

      const paddingTotal =
        data.CalculationValues?.find((item) => item.Type === "Padding")
          ?.Total || 0;

      const pristineTotal =
        data.CalculationValues?.find((item) => item.Type === "Pristine")
          ?.Total || 0;

      const totalCarpetCharge =
        retailCharge + fabricationCharge + paddingTotal + pristineTotal;

      return {
        ok: true,
        totalCarpetCharge: totalCarpetCharge,
        totalPadding: paddingTotal,
        totalPristine: pristineTotal,
      };
    })
    .catch((error) => {
      console.error("Error:", error);
      return {
        ok: false,
        error: error.message,
      };
    });
}

const PriceStore = {
  cache: {},

  async fetchGroupedPrices(SKU, widthInches, LengthInches, BindingMethod) {
    const cacheKey = `${SKU}-${widthInches}x${LengthInches}`;

    if (this.cache[cacheKey]) {
      console.log("Returning cached price:", cacheKey);
      return this.cache[cacheKey];
    }

    const requestParams = [
      { isPadding: false, isPristine: false },
      { isPadding: true, isPristine: false },
      { isPadding: false, isPristine: true },
      { isPadding: true, isPristine: true },
    ];

    const requests = requestParams.map(({ isPadding, isPristine }) => {
      const key = generatePriceKey(isPristine, isPadding);
      return getPriceFromStark({
        SKU,
        isPadding,
        isPristine,
        widthInches,
        LengthInches,
        BindingMethod,
      }).then((result) => ({ key, result }));
    });

    const results = await Promise.all(requests);

    this.cache[cacheKey] = results.reduce((acc, { key, result }) => {
      acc[key] = result;
      return acc;
    }, {});

    return this.cache[cacheKey];
  },

  async getPrice(SKU, widthInches, LengthInches, isPristine, isPadding) {
    const cacheKey = `${SKU}-${widthInches}x${LengthInches}`;
    const priceKey = generatePriceKey(isPristine, isPadding);

    if (!this.cache[cacheKey]) {
      console.log("Fetching new prices...");
      await this.fetchGroupedPrices(SKU, widthInches, LengthInches, "Serging");
    }

    return this.cache[cacheKey][priceKey]; // ✅ Returns only the needed price
  },
};

function generatePriceKey(isPristine, isPadding) {
  if (isPristine && isPadding) return "priceWithBoth";
  if (isPristine) return "priceWithPristine";
  if (isPadding) return "priceWithPadding";
  return "price";
}
