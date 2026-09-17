import React, { useState, useMemo, useEffect } from "react";
import { Search, ChevronRight, ChevronLeft, MapPin, ExternalLink, Filter, Gauge, X, FileText, Upload, Check, AlertTriangle, Sparkles, Bell } from "lucide-react";
// ---------- Mock data ----------
const BRANDS = [
  { id: "vw", name: "Volkswagen" },
  { id: "bmw", name: "BMW" },
  { id: "dacia", name: "Dacia" },
  { id: "renault", name: "Renault" },
  { id: "ford", name: "Ford" },
  { id: "audi", name: "Audi" },
];

const MODELS = {
  vw: ["Golf 5", "Golf 6", "Golf 7", "Passat B7", "Tiguan"],
  bmw: ["Seria 3 E90", "Seria 3 F30", "X5 E70", "Seria 1 F20"],
  dacia: ["Logan II", "Duster I", "Sandero II", "Duster II"],
  renault: ["Megane III", "Clio IV", "Scenic III"],
  ford: ["Focus 3", "Fiesta 6", "Mondeo IV"],
  audi: ["A4 B8", "A3 8V", "Q5 8R"],
};

const YEARS = ["2010", "2012", "2014", "2016", "2018", "2020"];

const CATEGORIES = ["Toate", "Frâne", "Filtre", "Suspensie", "Electrice", "Caroserie"];

const SUPPLIERS = [
  { id: "s1", name: "AutoDoc PL", country: "Polonia", quality: "OE supplier", shipping: 0, days: 4 },
  { id: "s2", name: "PiesePro RO", country: "România", quality: "Original", shipping: 15, days: 2 },
  { id: "s3", name: "TeilePartner DE", country: "Germania", quality: "Aftermarket premium", shipping: 22, days: 6 },
];

function makePart(name, oem, category, base) {
  const offers = SUPPLIERS.map((s, i) => {
    const variance = [0, 0.06, -0.04][i];
    const price = Math.round(base * (1 + variance));
    const inStock = i !== 2 || base < 400; // al 3-lea furnizor "la comandă" pentru piese scumpe, ca variație
    return {
      ...s,
      price,
      totalPrice: price + s.shipping,
      inStock,
    };
  }).sort((a, b) => a.totalPrice - b.totalPrice);
  return { name, oem, category, offers };
}

const PARTS_TEMPLATE = [
  makePart("Set plăcuțe frână față", "1K0698151", "Frâne", 180),
  makePart("Disc frână față ventilat", "1K0615301AA", "Frâne", 220),
  makePart("Filtru ulei", "03C115561H", "Filtre", 35),
  makePart("Filtru aer", "1K0129620D", "Filtre", 55),
  makePart("Filtru polen carbon activ", "1K1819653B", "Filtre", 62),
  makePart("Amortizor spate", "1K0513029AC", "Suspensie", 340),
  makePart("Bieletă stabilizator față", "1K0411315T", "Suspensie", 68),
  makePart("Alternator", "03L903023P", "Electrice", 890),
  makePart("Bujie incandescere", "059glow0002", "Electrice", 90),
  makePart("Oglindă retrovizoare stânga", "1K1857507", "Caroserie", 410),
  makePart("Far față dreapta", "1K6941016", "Caroserie", 720),
];

// Piese "identificate" dintr-un deviz de service, pentru simularea modului de upload
const DEVIZ_RESULTS = [
  { ...makePart("Kit distribuție", "03L198119B", "Motor", 480), match: "sigur", note: "Cod confirmat pentru motorizarea identificată" },
  { ...makePart("Pompă apă", "03L121011H", "Motor", 210), match: "sigur", note: "Cod confirmat, compatibil cu kitul de distribuție ales" },
  { ...makePart("Curea accesorii", "03L903137D", "Motor", 95), match: "de_verificat", note: "Denumire generică pe deviz — există 2 variante posibile" },
  { ...makePart("Întinzător curea", "03L903315A", "Motor", 160), match: "sigur", note: "Cod confirmat pentru acest kit" },
  { ...makePart("Antigel concentrat 1.5L", "G13-1.5L", "Fluide", 45), match: "de_verificat", note: "Marca nespecificată pe deviz — verifică specificația G12+/G13" },
];

// Normalizează un obiect din răspunsul AutoPartsAPI, indiferent de numele exact al câmpurilor
// (documentația publică nu arată exemple JSON complete pentru manufacturers/models/vehicles,
// doar pentru articles — la prima rulare reală, verificăm în consolă răspunsul brut și ajustăm
// aceste liste de câmpuri candidate dacă e nevoie, în câteva minute).
function normalizeItem(obj, idKeys, nameKeys) {
  const id = idKeys.map((k) => obj[k]).find((v) => v !== undefined);
  const name = nameKeys.map((k) => obj[k]).find((v) => v !== undefined);
  return { id, name, raw: obj };
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  const arrKey = Object.keys(payload || {}).find((k) => Array.isArray(payload[k]));
  return arrKey ? payload[arrKey] : [];
}

async function apiGet(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || `Eroare ${res.status}`);
    err.code = data.error;
    throw err;
  }
  return data;
}

// ---------- Component ----------
export default function App() {
  const [brand, setBrand] = useState(null);
  const [model, setModel] = useState(null);
  const [year, setYear] = useState(null);
  const [category, setCategory] = useState("Toate");
  const [query, setQuery] = useState("");
  const [openPart, setOpenPartRaw] = useState(null);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertSetFor, setAlertSetFor] = useState(null);
  const setOpenPart = (part) => {
    setAlertPrice("");
    setAlertSetFor(null);
    setOpenPartRaw(part);
  };
  const [openLegal, setOpenLegal] = useState(null); // 'comparator' | 'privacy' | null
  const [searchMode, setSearchMode] = useState("vehicle"); // 'vehicle' | 'oem' | 'deviz'
  const [oemQuery, setOemQuery] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [devizStatus, setDevizStatus] = useState("idle"); // 'idle' | 'processing' | 'done'

  // ---- Strat de date reale (AutoPartsAPI), cu fallback pe mock dacă API-ul nu e configurat ----
  const [dataSource, setDataSource] = useState("loading"); // 'loading' | 'real' | 'mock'
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [realParts, setRealParts] = useState(null); // null = folosim PARTS_TEMPLATE mock
  const [partsLoading, setPartsLoading] = useState(false);
  const [oemLiveResults, setOemLiveResults] = useState(null); // null = folosim căutarea mock locală

  // La montare: încercăm mărcile reale. Dacă API-ul nu e configurat încă (fără cheie în Vercel),
  // cădem elegant pe lista mock — site-ul rămâne funcțional în ambele cazuri.
  useEffect(() => {
    let cancelled = false;
    apiGet("/api/manufacturers?typeId=1")
      .then((data) => {
        if (cancelled) return;
const EU_BRANDS = [
          "VOLKSWAGEN","BMW","MERCEDES-BENZ","AUDI","OPEL","FORD","RENAULT",
          "PEUGEOT","CITROEN","FIAT","SKODA","SEAT","VOLVO","DACIA","TOYOTA",
          "HONDA","HYUNDAI","KIA","NISSAN","MAZDA","MINI","PORSCHE",
          "LAND ROVER","JAGUAR","ALFA ROMEO","LANCIA","SUZUKI","SMART","CUPRA"
        ];
        const list = extractList(data)
          .map((it) =>
            normalizeItem(it, ["manuId", "manufacturerId", "id"], ["manufacturerName", "name", "description"])
          )
          .filter((b) => EU_BRANDS.includes((b.name || "").toUpperCase()));
        if (list.length > 0) {
          setBrands(list);
          setDataSource("real");
        } else {
          setBrands(BRANDS);
          setDataSource("mock");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBrands(BRANDS);
        setDataSource("mock");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Când se alege marca (doar dacă lucrăm cu date reale): încărcăm modelele reale
  useEffect(() => {
    if (dataSource !== "real" || !brand) return;
    let cancelled = false;
    setModelsLoading(true);
    apiGet(`/api/models?manufacturerId=${brand.id}`)
      .then((data) => {
        if (cancelled) return;
        const list = extractList(data).map((it) =>
          normalizeItem(it, ["modelId", "id"], ["modelName", "name", "description"])
        );
        setModels(list);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => !cancelled && setModelsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [brand, dataSource]);

  // Când se alege modelul (date reale): încărcăm variantele de motorizare/an (înlocuiesc "anul")
  useEffect(() => {
    if (dataSource !== "real" || !model) return;
    let cancelled = false;
    setVehiclesLoading(true);
    apiGet(`/api/vehicles?modelId=${model.id}`)
      .then((data) => {
        if (cancelled) return;
const list = extractList(data).map((it) => ({
          id: it.vehicleId,
          name: it.powerPs ? `${it.typeEngineName} — ${it.powerPs} CP` : it.typeEngineName || "Motorizare",
          raw: it,
        }));
        setVehicles(list);
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      })
      .finally(() => !cancelled && setVehiclesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [model, dataSource]);

  // Când se alege vehiculul exact (date reale): încărcăm categoriile-frunză, apoi piesele
  useEffect(() => {
    if (dataSource !== "real" || !year) return;
    let cancelled = false;
    setPartsLoading(true);
    apiGet(`/api/categories?vehicleId=${year.id}`)
      .then(async (catData) => {
        const catList = extractList(catData).map((it) =>
          normalizeItem(it, ["categoryId", "id"], ["categoryName", "name", "description"])
        );
        const firstCats = catList.slice(0, 6); // limităm ca să nu consumăm tot cota gratuită dintr-o dată
        const results = [];
        for (const c of firstCats) {
          if (cancelled) return;
          try {
            const artData = await apiGet(`/api/parts?vehicleId=${year.id}&categoryId=${c.id}`);
            const arts = extractList(artData);
            for (const a of arts) {
             results.push({
                name: a.articleProductName || "Piesă",
                oem: a.articleNo || "—",
                category: c.name || "Altele",
                offers: SUPPLIERS.map((s, i) => {
                  const basePrice = 80 + (a.articleId % 400); // preț simulat, până conectăm feed-uri reale
                  const variance = [0, 0.06, -0.04][i];
                  const price = Math.round(basePrice * (1 + variance));
                  const inStock = i !== 2;
                  return { ...s, price, totalPrice: price + s.shipping, inStock };
                }).sort((x, y) => x.totalPrice - y.totalPrice),
              });
            }
          } catch {
            // continuăm cu următoarea categorie dacă una eșuează
          }
        }
        if (!cancelled) setRealParts(results);
      })
      .catch(() => {
        if (!cancelled) setRealParts([]);
      })
      .finally(() => !cancelled && setPartsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, dataSource]);

  const step = !brand ? 1 : !model ? 2 : !year ? 3 : 4;
  const modelLabel = model ? (typeof model === "object" ? model.name : model) : null;
  const yearLabel = year ? (typeof year === "object" ? year.name : year) : null;

  const oemResults = useMemo(() => {
    if (oemLiveResults !== null) return oemLiveResults;
    const q = oemQuery.trim().toLowerCase();
    if (!q) return [];
    return PARTS_TEMPLATE.filter((p) => p.oem.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [oemQuery, oemLiveResults]);

  // Căutarea live după cod OEM (doar când avem date reale conectate)
  useEffect(() => {
    const q = oemQuery.trim();
    if (dataSource !== "real" || !q) {
      setOemLiveResults(null);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      apiGet(`/api/oem-search?code=${encodeURIComponent(q)}`)
        .then((data) => {
          if (cancelled) return;
          const list = extractList(data).map((a) => ({
            name: a.articleProductName || "Piesă",
            oem: a.articleNo || q,
            offers: SUPPLIERS.map((s, i) => {
              const basePrice = 80 + ((a.articleId || q.length * 37) % 400);
              const variance = [0, 0.06, -0.04][i];
              const price = Math.round(basePrice * (1 + variance));
              return { ...s, price, totalPrice: price + s.shipping, inStock: i !== 2 };
            }).sort((x, y) => x.totalPrice - y.totalPrice),
          }));
          setOemLiveResults(list);
        })
        .catch(() => !cancelled && setOemLiveResults([]));
    }, 400); // debounce
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [oemQuery, dataSource]);

  const filteredParts = useMemo(() => {
    const source = realParts !== null ? realParts : PARTS_TEMPLATE;
    return source.filter((p) => {
      const matchCat = category === "Toate" || p.category === category;
      const matchQuery = p.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [category, query, realParts]);
  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, brandQuery]);
const reset = () => {
    setBrand(null);
    setModel(null);
    setYear(null);
    setCategory("Toate");
    setQuery("");
    setBrandQuery("");
  };

  const goBack = () => {
    if (year) setYear(null);
    else if (model) setModel(null);
    else if (brand) setBrand(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#EFEBE2] text-[#191B1D] font-sans">
      {/* Header */}
      <header className="bg-[#14181C] text-[#EFEBE2] px-5 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button onClick={goBack} aria-label="Înapoi" className="p-1 -ml-1 rounded hover:bg-white/10">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button onClick={reset} className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-[#E8A33D]" strokeWidth={2.2} />
            <span className="font-semibold tracking-tight text-lg">RadarPiese.ro</span>
          </button>
        </div>
        {step === 4 && (
          <div className="text-xs text-[#A9A398] text-right leading-tight">
            <div className="text-[#E8A33D] font-medium">{brand.name} {modelLabel}</div>
            <div>{yearLabel}</div>
          </div>
        )}
      </header>

      {/* Progress crumbs */}
      {step > 1 && (
        <div className="flex items-center gap-1 px-5 py-2.5 text-xs text-[#6B655A] bg-[#E4DFD3] overflow-x-auto whitespace-nowrap">
          <button onClick={reset} className="hover:text-[#191B1D]">Marcă</button>
          {brand && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <button onClick={() => { setModel(null); setYear(null); }} className="hover:text-[#191B1D] font-medium text-[#191B1D]">{brand.name}</button>
            </>
          )}
          {model && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <button onClick={() => setYear(null)} className="hover:text-[#191B1D] font-medium text-[#191B1D]">{modelLabel}</button>
            </>
          )}
          {year && (
            <>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="font-medium text-[#191B1D]">{yearLabel}</span>
            </>
          )}
        </div>
      )}

      <main className="px-5 py-6 pb-16">
        {/* STEP 1: Brand or OEM search */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-semibold leading-snug mb-1">Găsește piesa potrivită,<br />la cel mai bun preț.</h1>
            <p className="text-sm text-[#6B655A] mb-5">Comparăm ofertele OEM din mai mulți furnizori, în timp real.</p>

            <div className="flex gap-1 mb-5 bg-[#E4DFD3] rounded-lg p-1">
              <button
                onClick={() => setSearchMode("vehicle")}
                className={`flex-1 py-2 rounded-md text-[11px] font-medium ${
                  searchMode === "vehicle" ? "bg-white text-[#191B1D]" : "text-[#6B655A]"
                }`}
              >
                După mașină
              </button>
              <button
                onClick={() => setSearchMode("oem")}
                className={`flex-1 py-2 rounded-md text-[11px] font-medium ${
                  searchMode === "oem" ? "bg-white text-[#191B1D]" : "text-[#6B655A]"
                }`}
              >
                Cod OEM
              </button>
              <button
                onClick={() => setSearchMode("deviz")}
                className={`flex-1 py-2 rounded-md text-[11px] font-medium ${
                  searchMode === "deviz" ? "bg-white text-[#191B1D]" : "text-[#6B655A]"
                }`}
              >
                Deviz service
              </button>
            </div>

{searchMode === "vehicle" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-[#6B655A]">Alege marca mașinii</div>
                  {dataSource === "real" && (
                    <span className="text-[10px] text-[#3B6D11] font-medium">date live</span>
                  )}
                </div>
                {dataSource === "loading" ? (
                  <div className="text-center text-sm text-[#6B655A] py-10">Se încarcă mărcile…</div>
                ) : (
                  <>
                    <div className="relative mb-3">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A9A398]" />
                      <input
                        value={brandQuery}
                        onChange={(e) => setBrandQuery(e.target.value)}
                        placeholder="Caută marca (ex. Volkswagen)"
                        className="w-full bg-white border border-[#D8D2C4] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#191B1D]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {filteredBrands.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBrand(b)}
                          className="bg-white border border-[#D8D2C4] rounded-lg py-4 px-3 text-left hover:border-[#191B1D] transition-colors"
                        >
                          <span className="font-medium text-sm">{b.name}</span>
                        </button>
                      ))}
                    </div>
                    {filteredBrands.length === 0 && (
                      <div className="text-center text-sm text-[#6B655A] py-10">Nicio marcă găsită.</div>
                    )}
                  </>
                )}
              </div>
            ) : (            
             <div>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A9A398]" />
                  <input
                    value={oemQuery}
                    onChange={(e) => setOemQuery(e.target.value)}
                    placeholder="Cod OEM (ex. 1K0698151) sau denumire"
                    className="w-full bg-white border border-[#D8D2C4] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#191B1D]"
                  />
                </div>

                {oemQuery.trim() === "" && (
                  <p className="text-xs text-[#6B655A]">Introdu un cod OEM de pe piesa veche, sau denumirea piesei căutate.</p>
                )}

                {oemQuery.trim() !== "" && (
                  <div className="flex flex-col gap-2.5">
                    {oemResults.map((p) => {
                      const best = p.offers[0];
                      return (
                        <button
                          key={p.oem}
                          onClick={() => setOpenPart(p)}
                          className="bg-white border border-[#D8D2C4] rounded-lg p-3.5 text-left hover:border-[#191B1D] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{p.name}</div>
                              <div className="text-[11px] text-[#A9A398] font-mono mt-0.5">OEM {p.oem}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[15px] font-semibold text-[#191B1D]">{best.totalPrice} lei</div>
                              <div className="text-[10px] text-[#6B655A]">de la {p.offers.length} furnizori</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {oemResults.length === 0 && (
                      <div className="text-center text-sm text-[#6B655A] py-10">Niciun rezultat pentru acest cod. Încearcă alt termen.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {searchMode === "deviz" && (
              <div>
                {devizStatus === "idle" && (
                  <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-[#B9B2A2] rounded-lg py-10 px-4 bg-white cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={() => {
                        setDevizStatus("processing");
                        setTimeout(() => setDevizStatus("done"), 1400);
                      }}
                    />
                    <Upload className="w-5 h-5 text-[#6B655A]" />
                    <span className="text-sm font-medium">Încarcă poza sau PDF-ul devizului</span>
                    <span className="text-[11px] text-[#A9A398] text-center">Identificăm automat piesele și le comparăm prețul</span>
                  </label>
                )}

                {devizStatus === "processing" && (
                  <div className="flex flex-col items-center justify-center gap-2 py-14">
                    <FileText className="w-5 h-5 text-[#6B655A] animate-pulse" />
                    <span className="text-sm text-[#6B655A]">Citim devizul și identificăm piesele…</span>
                  </div>
                )}

                {devizStatus === "done" && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3 text-[11px] text-[#6B655A]">
                      <Sparkles className="w-3.5 h-3.5 text-[#E8A33D]" />
                      5 piese identificate din deviz
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {DEVIZ_RESULTS.map((p) => {
                        const best = p.offers[0];
                        const sure = p.match === "sigur";
                        return (
                          <button
                            key={p.oem}
                            onClick={() => setOpenPart(p)}
                            className="bg-white border border-[#D8D2C4] rounded-lg p-3.5 text-left hover:border-[#191B1D] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{p.name}</div>
                                <div className="text-[11px] text-[#A9A398] font-mono mt-0.5">OEM {p.oem}</div>
                                <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-medium ${sure ? "text-[#3B6D11]" : "text-[#854F0B]"}`}>
                                  {sure ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                  {sure ? "Compatibilitate confirmată" : "De verificat cu un specialist"}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[15px] font-semibold text-[#191B1D]">{best.totalPrice} lei</div>
                                <div className="text-[10px] text-[#6B655A]">de la {p.offers.length} furnizori</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setDevizStatus("idle")}
                      className="w-full mt-3 border border-[#D8D2C4] rounded-lg py-2.5 text-xs font-medium text-[#6B655A]"
                    >
                      Încarcă alt deviz
                    </button>
                    <p className="text-[10px] text-[#A9A398] mt-3 leading-relaxed">
                      Identificarea se face automat, printr-un model AI, pe baza textului din deviz. Pentru piese esențiale
                      pentru siguranță (frâne, direcție, suspensie), confirmă întotdeauna codul exact cu service-ul tău
                      înainte de comandă.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Model */}
        {step === 2 && (
          <div>
            <div className="text-xs font-medium text-[#6B655A] mb-2">Alege modelul {brand.name}</div>
            {dataSource === "real" && modelsLoading ? (
              <div className="text-center text-sm text-[#6B655A] py-10">Se încarcă modelele…</div>
            ) : (
              <div className="flex flex-col gap-2">
                {(dataSource === "real" ? models : MODELS[brand.id].map((m) => ({ id: m, name: m }))).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m)}
                    className="bg-white border border-[#D8D2C4] rounded-lg py-3.5 px-4 flex items-center justify-between hover:border-[#191B1D] transition-colors"
                  >
                    <span className="font-medium text-sm">{m.name}</span>
                    <ChevronRight className="w-4 h-4 text-[#A9A398]" />
                  </button>
                ))}
                {dataSource === "real" && models.length === 0 && (
                  <div className="text-center text-sm text-[#6B655A] py-6">Niciun model găsit pentru această marcă.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Year / motorizare */}
        {step === 3 && (
          <div>
            <div className="text-xs font-medium text-[#6B655A] mb-2">
              {dataSource === "real" ? "Alege motorizarea" : "An fabricație"} — {brand.name} {modelLabel}
            </div>
            {dataSource === "real" ? (
              vehiclesLoading ? (
                <div className="text-center text-sm text-[#6B655A] py-10">Se încarcă variantele…</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setYear(v)}
                      className="bg-white border border-[#D8D2C4] rounded-lg py-3.5 px-4 flex items-center justify-between hover:border-[#191B1D] transition-colors text-left"
                    >
                      <span className="font-medium text-sm">{v.name}</span>
                      <ChevronRight className="w-4 h-4 text-[#A9A398] shrink-0" />
                    </button>
                  ))}
                  {vehicles.length === 0 && (
                    <div className="text-center text-sm text-[#6B655A] py-6">Nicio variantă găsită pentru acest model.</div>
                  )}
                </div>
              )
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className="bg-white border border-[#D8D2C4] rounded-lg py-3.5 text-center font-medium text-sm hover:border-[#191B1D] transition-colors"
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Results */}
        {step === 4 && (
          <div>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A9A398]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Caută piesă (ex. filtru ulei)"
                className="w-full bg-white border border-[#D8D2C4] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#191B1D]"
              />
            </div>

            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              {(realParts !== null ? ["Toate", ...Array.from(new Set(realParts.map((p) => p.category)))] : CATEGORIES).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                    category === c
                      ? "bg-[#14181C] text-[#EFEBE2] border-[#14181C]"
                      : "bg-white text-[#6B655A] border-[#D8D2C4]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {dataSource === "real" && partsLoading ? (
              <div className="text-center text-sm text-[#6B655A] py-10">Căutăm piesele compatibile…</div>
            ) : (
            <>
            <div className="text-xs text-[#6B655A] mb-3">{filteredParts.length} piese compatibile găsite</div>

            <div className="flex flex-col gap-2.5">
              {filteredParts.map((p, idx) => {
                const best = p.offers[0];
                return (
                  <button
                    key={`${p.oem}-${idx}`}
                    onClick={() => setOpenPart(p)}
                    className="bg-white border border-[#D8D2C4] rounded-lg p-3.5 text-left hover:border-[#191B1D] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="text-[11px] text-[#A9A398] font-mono mt-0.5">OEM {p.oem}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[15px] font-semibold text-[#191B1D]">{best.totalPrice} lei</div>
                        <div className="text-[10px] text-[#6B655A]">de la {p.offers.length} furnizori</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredParts.length === 0 && (
                <div className="text-center text-sm text-[#6B655A] py-10">Nimic găsit. Încearcă alt termen sau categorie.</div>
              )}
            </div>
            </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D8D2C4] px-5 py-5 text-center">
        <p className="text-[11px] text-[#6B655A] leading-relaxed mb-2 max-w-xs mx-auto">
          radarpiese.ro compară oferte de la furnizori terți. Nu vindem piese direct — te redirecționăm către magazinul ales.
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <button onClick={() => setOpenLegal("comparator")} className="underline text-[#6B655A]">
            Cum funcționează comparatorul
          </button>
          <span className="text-[#D8D2C4]">·</span>
          <button onClick={() => setOpenLegal("privacy")} className="underline text-[#6B655A]">
            Confidențialitate și cookie-uri
          </button>
        </div>
      </footer>

      {/* Legal info sheet */}
      {openLegal && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-30" onClick={() => setOpenLegal(null)}>
          <div
            className="bg-[#EFEBE2] w-full rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="font-semibold text-base">
                {openLegal === "comparator" ? "Cum funcționează comparatorul" : "Confidențialitate și cookie-uri"}
              </div>
              <button onClick={() => setOpenLegal(null)} className="p-1 text-[#6B655A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {openLegal === "comparator" ? (
              <div className="text-[13px] text-[#3A3733] leading-relaxed flex flex-col gap-3">
                <p>
                  radarpiese.ro este un serviciu de comparare a prețurilor la piese auto OEM. Nu suntem vânzător, nu deținem
                  stoc și nu procesăm plăți — afișăm ofertele disponibile la furnizori terți și te redirecționăm către
                  site-ul lor pentru finalizarea comenzii.
                </p>
                <p>
                  Ordinea ofertelor se face strict după preț, de la cel mai mic la cel mai mare. Nicio ofertă nu este
                  promovată sau poziționată preferențial fără să fie marcată explicit ca atare.
                </p>
                <p>
                  Pentru unele comenzi finalizate prin linkurile noastre, putem primi un comision de la furnizor. Acest
                  lucru nu modifică prețul pe care îl plătești tu — comisionul este suportat integral de furnizor.
                </p>
                <p>
                  Contractul de vânzare, garanția și politica de retur se stabilesc direct între tine și furnizorul
                  ales, conform termenilor lui.
                </p>
              </div>
            ) : (
              <div className="text-[13px] text-[#3A3733] leading-relaxed flex flex-col gap-3">
                <p>
                  Colectăm datele minime necesare pentru funcționarea site-ului: căutările tale (marcă, model, an,
                  piesă) și, dacă ai un cont, adresa de email.
                </p>
                <p>
                  Folosim cookie-uri tehnice, necesare pentru funcționarea site-ului, și cookie-uri de afiliere, care
                  atribuie corect comisionul atunci când ajungi la un furnizor prin linkurile noastre. Poți refuza
                  cookie-urile neesențiale din setările browserului.
                </p>
                <p>
                  Nu vindem datele tale către terți. Le folosim doar pentru a-ți afișa rezultate relevante și, dacă
                  ai consimțit, pentru comunicări legate de ofertele căutate.
                </p>
                <p>Îți poți cere oricând datele sau ștergerea lor, conform GDPR, la o adresă de contact dedicată.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Part detail sheet */}
      {openPart && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-30" onClick={() => setOpenPart(null)}>
          <div
            className="bg-[#EFEBE2] w-full rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="font-semibold text-base">{openPart.name}</div>
                <div className="text-[11px] text-[#A9A398] font-mono mt-0.5">OEM {openPart.oem}</div>
              </div>
              <button onClick={() => setOpenPart(null)} className="p-1 text-[#6B655A]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[#6B655A] mb-4">
              {openPart.match
                ? openPart.note
                : brand
                ? `Compatibil cu ${brand.name} ${modelLabel || ""}, ${yearLabel || ""}`
                : "Găsit prin căutare după cod OEM"}
            </div>

            <div className="flex flex-col gap-2">
              {openPart.offers.map((o, i) => (
                <div
                  key={o.id}
                  className={`rounded-lg p-3.5 border ${i === 0 ? "border-[#E8A33D] bg-[#FBF1DE]" : "border-[#D8D2C4] bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm">{o.name}</span>
                        {i === 0 && (
                          <span className="text-[10px] font-medium bg-[#E8A33D] text-[#402B04] px-1.5 py-0.5 rounded">cel mai bun preț total</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#6B655A] mt-1">
                        <MapPin className="w-3 h-3" /> {o.country}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-medium bg-[#E4DFD3] text-[#4A463E] px-1.5 py-0.5 rounded">{o.quality}</span>
                        <span className={`text-[10px] font-medium ${o.inStock ? "text-[#3B6D11]" : "text-[#854F0B]"}`}>
                          {o.inStock ? "În stoc" : "La comandă"} · {o.days} zile
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-[15px]">{o.totalPrice} lei</div>
                      <div className="text-[10px] text-[#A9A398]">{o.price} lei + {o.shipping === 0 ? "transport gratuit" : `${o.shipping} lei transport`}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 bg-[#14181C] text-[#EFEBE2] rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2">
              Vezi oferta la furnizor <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-[#A9A398] text-center mt-2">
              Ești redirecționat către site-ul furnizorului. Putem primi un comision, fără costuri suplimentare pentru tine.
            </p>

            <div className="border-t border-[#D8D2C4] mt-4 pt-4">
              {alertSetFor === openPart.oem ? (
                <div className="flex items-center gap-2 text-sm text-[#3B6D11] bg-[#EAF3DE] rounded-lg py-2.5 px-3">
                  <Bell className="w-4 h-4 shrink-0" /> Te anunțăm când prețul total scade sub {alertPrice} lei.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Bell className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A9A398]" />
                    <input
                      type="number"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder={`sub ${openPart.offers[0].totalPrice} lei`}
                      className="w-full bg-white border border-[#D8D2C4] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#191B1D]"
                    />
                  </div>
                  <button
                    onClick={() => alertPrice && setAlertSetFor(openPart.oem)}
                    className="shrink-0 bg-white border border-[#D8D2C4] rounded-lg px-3.5 py-2.5 text-xs font-medium text-[#191B1D]"
                  >
                    Anunță-mă
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-[#A9A398] text-center mt-3">Date demonstrative. Fără furnizori reali conectați încă.</p>
          </div>
        </div>
      )}
    </div>
  );
}
