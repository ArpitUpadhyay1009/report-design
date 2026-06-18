"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProductCard, {
  type CardRateEntryProps,
} from "@/components/product-card/productCard";
import ProductRow from "@/components/product-row/productRow";
import RateEntryView from "@/components/rate-entry-view/rateEntryView";
import StatCard from "@/components/stat-card/statCard";
import { difficulties } from "@/constants/rate";
import {
  submitFilRate,
  submitManagerRate,
  submitPolRate,
  type DifficultyRate,
  type DesignWiseDifficulty,
  type FilledRate,
  type PolRate,
} from "@/services/api";
import type { Product } from "@/types/product";
import { totalRate } from "@/types/product";
import type { Profile, Role } from "@/types/profile";
import type {
  RateEntries,
  RateEntry,
  RateRole,
} from "@/types/rateEntry";
import {
  buildDesignDifficultiesByDmCtg,
  buildDifficultyToDmCtgMap,
  categoryRatesFor,
  designDifficultiesForDmCtg,
  filRateForDesignDifficulty,
  filRateForDifficulty,
  isPolSpCode,
  isFilSpCode,
  patchFromDmCtg,
  patchFromPolSp,
  polCategoryCodesFrom,
  polDropdownOptionsForDmCtg,
  productForFilledRate,
  resolveDefaultDesignDifficulty,
  resolveProductDmCtg,
} from "@/utils/rateEntryHelpers";
import "./productsReport.css";

type ViewMode = "grid" | "table" | "entry" | "completed";

export type RateDataStatus = "idle" | "loading" | "ready" | "error";

export type LoadState =
  | { status: "idle" }
  | { status: "needs-dates" }
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error"; message: string };

interface ProductsReportProps {
  load: LoadState;
  user: Profile;
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onRetryLoad: () => void;
  difficultyHeaders?: string[];
  difficultyRates?: DifficultyRate[];
  polRates?: PolRate[];
  filledRates?: FilledRate[];
  completedFilDesignIds?: string[];
  completedPolDesignIds?: string[];
  designWiseDifficulties?: DesignWiseDifficulty[];
  rateDataStatus?: RateDataStatus;
  onLoadRateData?: () => void;
}

const PAGE_SIZE = 10;

type CardSubmitState = CardRateEntryProps["submitState"];

const inr = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export default function ProductsReport({
  load,
  user,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onRetryLoad,
  difficultyHeaders,
  difficultyRates,
  polRates,
  filledRates,
  completedFilDesignIds,
  completedPolDesignIds,
  designWiseDifficulties,
  rateDataStatus = "idle",
  onLoadRateData,
}: ProductsReportProps) {
  const [view, setView] = useState<ViewMode>("table");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [rateEntries, setRateEntries] = useState<RateEntries>({});
  const [localCompletedFil, setLocalCompletedFil] = useState<Set<string>>(
    () => new Set()
  );
  const [localCompletedPol, setLocalCompletedPol] = useState<Set<string>>(
    () => new Set()
  );
  const [localCompletedManager, setLocalCompletedManager] = useState<
    Set<string>
  >(() => new Set());
  const [cardSubmitStates, setCardSubmitStates] = useState<
    Record<string, CardSubmitState>
  >({});
  const [cardSubmitMessages, setCardSubmitMessages] = useState<
    Record<string, string>
  >({});
  const [entryListMeta, setEntryListMeta] = useState({ shown: 0, total: 0 });

  const handleEntryListMetaChange = useCallback(
    (meta: { shown: number; total: number }) => {
      setEntryListMeta(meta);
    },
    []
  );

  const showCardRateEntry =
    user.role === "FIL" || user.role === "POL" || user.role === "MANAGER";

  const editableRole: RateRole | null =
    user.role === "FIL"
      ? "FIL"
      : user.role === "POL"
        ? "POL"
        : user.role === "MANAGER"
          ? "MANAGER"
          : null;

  const products = useMemo<Product[]>(
    () => (load.status === "success" ? load.products : []),
    [load]
  );
  const hasProducts = load.status === "success";

  const handleOpenGrid = useCallback(() => {
    setView("grid");
    if (showCardRateEntry) onLoadRateData?.();
  }, [onLoadRateData, showCardRateEntry]);

  const handleOpenEntry = useCallback(() => {
    setView("entry");
    onLoadRateData?.();
  }, [onLoadRateData]);

  const handleOpenCompleted = useCallback(() => {
    setView("completed");
    onLoadRateData?.();
  }, [onLoadRateData]);

  const showCompletedTab =
    user.role === "FIL" || user.role === "POL";

  const handleRateChange = useCallback(
    (productId: string, role: RateRole, patch: Partial<RateEntry>) => {
      setRateEntries((prev) => {
        const product = prev[productId] ?? {};
        const current = product[role] ?? {};
        const next: RateEntry = { ...current, ...patch };
        return {
          ...prev,
          [productId]: {
            ...product,
            [role]: next,
          },
        };
      });
    },
    []
  );

  const completedFilSet = useMemo(
    () =>
      new Set([
        ...(completedFilDesignIds ?? []),
        ...localCompletedFil,
      ]),
    [completedFilDesignIds, localCompletedFil]
  );

  const completedPolSet = useMemo(
    () =>
      new Set([
        ...(completedPolDesignIds ?? []),
        ...localCompletedPol,
      ]),
    [completedPolDesignIds, localCompletedPol]
  );

  const filledByDesign = useMemo(() => {
    const map = new Map<string, FilledRate>();
    (filledRates ?? []).forEach((r) => map.set(r.designId, r));
    return map;
  }, [filledRates]);

  const polRatesByCategory = useMemo(() => {
    const map = new Map<string, PolRate>();
    (polRates ?? []).forEach((r) => map.set(r.category, r));
    return map;
  }, [polRates]);

  const apiDifficultyCodes = useMemo(() => {
    if (
      (user.role === "FIL" || user.role === "MANAGER") &&
      difficultyHeaders &&
      difficultyHeaders.length > 0
    ) {
      return difficultyHeaders;
    }
    return Object.keys(difficulties);
  }, [user.role, difficultyHeaders]);

  const polCategoryCodes = useMemo(
    () => polCategoryCodesFrom(polRates ?? []),
    [polRates]
  );

  const designDifficultiesByDmCtg = useMemo(
    () => buildDesignDifficultiesByDmCtg(designWiseDifficulties ?? []),
    [designWiseDifficulties]
  );

  const difficultyToDmCtg = useMemo(
    () => buildDifficultyToDmCtgMap(designWiseDifficulties ?? []),
    [designWiseDifficulties]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.designCode.toLowerCase().includes(q) ||
        p.managerName.toLowerCase().includes(q) ||
        p.managerShort.toLowerCase().includes(q) ||
        p.custCode.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q)
    );
  }, [products, query]);

  const gridSourceProducts = useMemo(() => {
    if (!showCardRateEntry) return filtered;

    if (user.role === "MANAGER") {
      if (!filledRates?.length) return [];
      const productByDesign = new Map(
        products.map((p) => [p.designCode, p] as const)
      );
      return filledRates
        .map((filled) =>
          productForFilledRate(
            filled,
            productByDesign.get(filled.designId),
            difficultyToDmCtg
          )
        )
        .filter((p) => !localCompletedManager.has(p.designCode))
        .filter((p) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            p.designCode.toLowerCase().includes(q) ||
            p.managerName.toLowerCase().includes(q) ||
            p.managerShort.toLowerCase().includes(q) ||
            p.custCode.toLowerCase().includes(q) ||
            p.manufacturer.toLowerCase().includes(q)
          );
        });
    }

    if (user.role === "FIL") {
      return filtered.filter((p) => !completedFilSet.has(p.designCode));
    }

    if (user.role === "POL") {
      return filtered.filter((p) => !completedPolSet.has(p.designCode));
    }

    return filtered;
  }, [
    showCardRateEntry,
    user.role,
    filtered,
    products,
    filledRates,
    localCompletedManager,
    completedFilSet,
    completedPolSet,
    query,
    difficultyToDmCtg,
  ]);

  const activeList =
    view === "grid" && showCardRateEntry ? gridSourceProducts : filtered;

  // Reset pagination when the underlying list or filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [products, query, fromDate, toDate, view, activeList.length]);

  const visibleProducts = useMemo(
    () => activeList.slice(0, visibleCount),
    [activeList, visibleCount]
  );

  const hasMore = visibleCount < activeList.length;
  const remainingCount = activeList.length - visibleCount;

  const handleShowMore = useCallback(() => {
    setVisibleCount((n) => Math.min(n + PAGE_SIZE, activeList.length));
  }, [activeList.length]);

  const isCardProductValid = useCallback(
    (p: Product): boolean => {
      if (!editableRole) return false;

      if (user.role === "FIL") {
        const e = rateEntries[p.id]?.FIL;
        const resolvedDmCtg = resolveProductDmCtg(
          p,
          designDifficultiesByDmCtg,
          difficultyToDmCtg
        );
        const options = designDifficultiesForDmCtg(
          designDifficultiesByDmCtg,
          resolvedDmCtg
        );
        const difficulty =
          e?.difficulty ?? resolveDefaultDesignDifficulty(options, p.difficulty);
        const filRate =
          e?.filRate ??
          (difficulty
            ? filRateForDesignDifficulty(
              difficultyRates ?? [],
              difficulty,
              p.custType
            )
            : undefined);
        return (
          !!difficulty &&
          difficulty.length > 0 &&
          typeof filRate === "number" &&
          Number.isFinite(filRate)
        );
      }

      if (user.role === "POL") {
        const sectionEntry = rateEntries[p.id]?.POL ?? {};
        const effectiveDmCtg = sectionEntry.dmCtg ?? p.polCtg;
        if (!effectiveDmCtg) return false;
        const lookup = categoryRatesFor(
          polRates ?? [],
          effectiveDmCtg,
          p.custType
        );
        const polRate = sectionEntry.polRate ?? lookup.polRate;
        const prpRate = sectionEntry.prpRate ?? lookup.prpRate;
        return (
          typeof polRate === "number" &&
          Number.isFinite(polRate) &&
          typeof prpRate === "number" &&
          Number.isFinite(prpRate)
        );
      }

      if (user.role === "MANAGER") {
        const filled = filledByDesign.get(p.designCode);
        const sectionEntry = rateEntries[p.id]?.MANAGER ?? {};
        const resolvedDmCtg = resolveProductDmCtg(
          p,
          designDifficultiesByDmCtg,
          difficultyToDmCtg,
          filled
        );
        const options = designDifficultiesForDmCtg(
          designDifficultiesByDmCtg,
          resolvedDmCtg
        );
        const difficulty =
          sectionEntry.difficulty ??
          resolveDefaultDesignDifficulty(
            options,
            filled?.difficulty ?? p.difficulty
          );
        const filRate =
          sectionEntry.filRate ??
          (difficulty
            ? filRateForDesignDifficulty(
              difficultyRates ?? [],
              difficulty,
              p.custType
            )
            : filled?.filRate);
        if (
          typeof difficulty !== "string" ||
          difficulty.length === 0 ||
          typeof filRate !== "number" ||
          !Number.isFinite(filRate)
        ) {
          return false;
        }
        const effectiveDmCtg =
          sectionEntry.dmCtg ?? resolvedDmCtg ?? filled?.dmCtg ?? "";
        if (!effectiveDmCtg) return false;
        const polEntry = polRatesByCategory.get(effectiveDmCtg);
        if (!polEntry) return false;
        const isO = p.custType === "O";
        const isB = p.custType === "B";
        if (!isO && !isB) return false;
        const polRate = isO ? polEntry.normalPol : polEntry.brandPol;
        const prpRate = isO ? polEntry.normalPrp : polEntry.brandPrp;
        return (
          typeof polRate === "number" &&
          typeof prpRate === "number"
        );
      }

      return false;
    },
    [editableRole, user.role, rateEntries, polRatesByCategory, filledByDesign, difficultyRates, designDifficultiesByDmCtg, difficultyToDmCtg]
  );

  const handleCardDifficultyChange = useCallback(
    (product: Product, code: string) => {
      if (!editableRole || user.role === "POL") return;
      const role: RateRole = user.role === "MANAGER" ? "MANAGER" : "FIL";
      const filRate = isFilSpCode(code) ? 0 : (
        user.role === "FIL"
          ? filRateForDesignDifficulty(
            difficultyRates ?? [],
            code,
            product.custType
          )
          : filRateForDifficulty(
            difficultyRates ?? [],
            code,
            product.custType
          )
      );
      handleRateChange(product.id, role, {
        difficulty: code,
        filRate,
      });
    },
    [editableRole, user.role, difficultyRates, handleRateChange]
  );

  const handleCardPolOptionChange = useCallback(
    (product: Product, option: string) => {
      if (!editableRole || user.role !== "POL") return;
      const isPolSp = isPolSpCode(polRates ?? [], option);
      const patch = isPolSp
        ? { ...patchFromPolSp(polRates ?? [], option, product.custType), polRate: 0, prpRate: 0 }
        : patchFromDmCtg(polRates ?? [], option, product.custType);
      handleRateChange(product.id, "POL", patch);
    },
    [editableRole, user.role, polRates, handleRateChange]
  );

  const handleCardDmCtgChange = useCallback(
    (product: Product, dmCtg: string) => {
      if (!editableRole || user.role !== "MANAGER") return;
      const rates = categoryRatesFor(polRates ?? [], dmCtg, product.custType);
      handleRateChange(product.id, "MANAGER", {
        dmCtg,
        polRate: rates.polRate,
        prpRate: rates.prpRate,
      });
    },
    [editableRole, user.role, polRates, handleRateChange]
  );

  const handleCardPolRateChange = useCallback(
    (product: Product, rate: number | undefined) => {
      if (!editableRole || user.role !== "POL") return;
      handleRateChange(product.id, "POL", { polRate: rate });
    },
    [editableRole, user.role, handleRateChange]
  );

  const handleCardPrpRateChange = useCallback(
    (product: Product, rate: number | undefined) => {
      if (!editableRole || user.role !== "POL") return;
      handleRateChange(product.id, "POL", { prpRate: rate });
    },
    [editableRole, user.role, handleRateChange]
  );

  const handleCardFilRateChange = useCallback(
    (product: Product, rate: number | undefined) => {
      if (!editableRole || (user.role !== "FIL" && user.role !== "MANAGER")) return;
      const role: RateRole = user.role === "MANAGER" ? "MANAGER" : "FIL";
      handleRateChange(product.id, role, { filRate: rate });
    },
    [editableRole, user.role, handleRateChange]
  );

  const handleCardSubmit = useCallback(
    async (product: Product) => {
      if (!editableRole || !user.userId) return;
      if (!isCardProductValid(product)) return;
      if (cardSubmitStates[product.id] === "submitting") return;

      setCardSubmitStates((s) => ({ ...s, [product.id]: "submitting" }));
      setCardSubmitMessages((m) => {
        const next = { ...m };
        delete next[product.id];
        return next;
      });

      try {
        if (user.role === "FIL") {
          const resolvedDmCtg = resolveProductDmCtg(
            product,
            designDifficultiesByDmCtg,
            difficultyToDmCtg
          );
          const options = designDifficultiesForDmCtg(
            designDifficultiesByDmCtg,
            resolvedDmCtg
          );
          const sectionEntry = rateEntries[product.id]?.FIL ?? {};
          const difficulty =
            sectionEntry.difficulty ??
            resolveDefaultDesignDifficulty(options, product.difficulty);
          const filRate =
            sectionEntry.filRate ??
            (difficulty
              ? filRateForDesignDifficulty(
                difficultyRates ?? [],
                difficulty,
                product.custType
              )
              : undefined);
          const result = await submitFilRate({
            user_id: user.userId,
            design_id: product.designCode,
            difficulty: difficulty as string,
            fil_rate: filRate as number,
          });
          if (result.status === "1") {
            setLocalCompletedFil((prev) =>
              new Set([...prev, product.designCode])
            );
            setCardSubmitStates((s) => ({ ...s, [product.id]: "done" }));
          } else {
            const message = Array.isArray(result.message)
              ? result.message.join(", ")
              : result.message;
            setCardSubmitStates((s) => ({ ...s, [product.id]: "error" }));
            setCardSubmitMessages((m) => ({
              ...m,
              [product.id]: message,
            }));
          }
        } else if (user.role === "POL") {
          const sectionEntry = rateEntries[product.id]?.POL ?? {};
          const effectiveDmCtg = sectionEntry.dmCtg ?? product.polCtg;
          const lookup = categoryRatesFor(
            polRates ?? [],
            effectiveDmCtg,
            product.custType
          );
          const result = await submitPolRate({
            user_id: user.userId,
            design_id: product.designCode,
            pol_rate: (sectionEntry.polRate ?? lookup.polRate) as number,
            prp_rate: (sectionEntry.prpRate ?? lookup.prpRate) as number,
          });
          if (result.status === "1") {
            setLocalCompletedPol((prev) =>
              new Set([...prev, product.designCode])
            );
            setCardSubmitStates((s) => ({ ...s, [product.id]: "done" }));
          } else {
            const message = Array.isArray(result.message)
              ? result.message.join(", ")
              : result.message;
            setCardSubmitStates((s) => ({ ...s, [product.id]: "error" }));
            setCardSubmitMessages((m) => ({
              ...m,
              [product.id]: message,
            }));
          }
        } else if (user.role === "MANAGER") {
          const filled = filledByDesign.get(product.designCode);
          const sectionEntry = rateEntries[product.id]?.MANAGER ?? {};
          const resolvedDmCtg = resolveProductDmCtg(
            product,
            designDifficultiesByDmCtg,
            difficultyToDmCtg,
            filled
          );
          const options = designDifficultiesForDmCtg(
            designDifficultiesByDmCtg,
            resolvedDmCtg
          );
          const difficulty =
            sectionEntry.difficulty ??
            resolveDefaultDesignDifficulty(
              options,
              filled?.difficulty ?? product.difficulty
            );
          const filRate =
            sectionEntry.filRate ??
            (difficulty
              ? filRateForDesignDifficulty(
                difficultyRates ?? [],
                difficulty,
                product.custType
              )
              : filled?.filRate);
          const effectiveDmCtg =
            sectionEntry.dmCtg ?? resolvedDmCtg ?? filled?.dmCtg ?? "";
          const lookup = categoryRatesFor(
            polRates ?? [],
            effectiveDmCtg,
            product.custType
          );
          const result = await submitManagerRate({
            user_id: user.userId,
            design_id: product.designCode,
            difficulty: difficulty as string,
            manager_fil_rate: filRate as number,
            manager_pol_rate: (sectionEntry.polRate ?? lookup.polRate) as number,
            manager_prp_rate: (sectionEntry.prpRate ?? lookup.prpRate) as number,
          });
          if (result.status === "1") {
            setLocalCompletedManager((prev) =>
              new Set([...prev, product.designCode])
            );
            setCardSubmitStates((s) => ({ ...s, [product.id]: "done" }));
          } else {
            const message = Array.isArray(result.message)
              ? result.message.join(", ")
              : result.message;
            setCardSubmitStates((s) => ({ ...s, [product.id]: "error" }));
            setCardSubmitMessages((m) => ({
              ...m,
              [product.id]: message,
            }));
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Submission failed.";
        setCardSubmitStates((s) => ({ ...s, [product.id]: "error" }));
        setCardSubmitMessages((m) => ({ ...m, [product.id]: message }));
      }
    },
    [
      editableRole,
      user.userId,
      user.role,
      isCardProductValid,
      cardSubmitStates,
      rateEntries,
      polRates,
      filledByDesign,
      difficultyRates,
      designDifficultiesByDmCtg,
      difficultyToDmCtg,
    ]
  );

  const buildCardRateEntry = useCallback(
    (product: Product): CardRateEntryProps | undefined => {
      if (!showCardRateEntry || !editableRole || rateDataStatus !== "ready") {
        return undefined;
      }

      const filled = filledByDesign.get(product.designCode);
      const resolvedDmCtg = resolveProductDmCtg(
        product,
        designDifficultiesByDmCtg,
        difficultyToDmCtg,
        filled
      );
      const sectionEntry = rateEntries[product.id]?.[editableRole] ?? {};
      const filDifficultyOptions =
        user.role === "FIL" || user.role === "MANAGER"
          ? designDifficultiesForDmCtg(
            designDifficultiesByDmCtg,
            resolvedDmCtg
          )
          : apiDifficultyCodes;
      const defaultFilDifficulty =
        user.role === "FIL" || user.role === "MANAGER"
          ? resolveDefaultDesignDifficulty(
            filDifficultyOptions,
            filled?.difficulty ?? product.difficulty
          )
          : undefined;
      const difficulty =
        sectionEntry.difficulty ??
        defaultFilDifficulty ??
        (user.role === "MANAGER" ? filled?.difficulty : undefined);
      const dmCtg =
        sectionEntry.dmCtg ?? resolvedDmCtg ?? filled?.dmCtg ?? "";
      const polDropdownOptions = polDropdownOptionsForDmCtg(
        polRates ?? [],
        resolvedDmCtg
      );
      const polDropdownValue =
        sectionEntry.polSp ?? sectionEntry.dmCtg ?? resolvedDmCtg;
      const lookupRates = categoryRatesFor(
        polRates ?? [],
        dmCtg,
        product.custType
      );
      const filRate =
        sectionEntry.filRate ??
        (difficulty
          ? user.role === "FIL" || user.role === "MANAGER"
            ? filRateForDesignDifficulty(
              difficultyRates ?? [],
              difficulty,
              product.custType
            )
            : filRateForDifficulty(
              difficultyRates ?? [],
              difficulty,
              product.custType
            )
          : undefined);

      // When POL_SP is selected, initialize rates to 0 instead of using lookupRates
      const isCurrentlyPolSp = polDropdownValue && isPolSpCode(polRates ?? [], polDropdownValue);
      const effectivePolRate = isCurrentlyPolSp ? (sectionEntry.polRate ?? 0) : (sectionEntry.polRate ?? lookupRates.polRate);
      const effectivePrpRate = isCurrentlyPolSp ? (sectionEntry.prpRate ?? 0) : (sectionEntry.prpRate ?? lookupRates.prpRate);
      const suggestedPol = isCurrentlyPolSp ? 0 : lookupRates.polRate;
      const suggestedPrp = isCurrentlyPolSp ? 0 : lookupRates.prpRate;

      // When a FIL special code (ending with SP) is selected, initialize rate to 0
      const isCurrentlyFilSp = difficulty && isFilSpCode(difficulty);
      const effectiveFilRate = isCurrentlyFilSp ? (sectionEntry.filRate ?? 0) : filRate;
      const suggestedFilRate = isCurrentlyFilSp ? 0 : filRate;

      return {
        role: user.role,
        difficultyOptions: filDifficultyOptions,
        polDropdownOptions,
        polCategoryCodes,
        usePolDualDropdown: user.role === "POL" || user.role === "MANAGER",
        polRatesEditable:
          user.role === "POL" &&
          sectionEntry.polSp !== undefined,
        filRatesEditable:
          (user.role === "FIL" || user.role === "MANAGER") &&
          difficulty !== undefined &&
          isFilSpCode(difficulty),
        difficulty,
        polDropdownValue,
        dmCtg,
        filRate: effectiveFilRate,
        polRate: effectivePolRate,
        prpRate: effectivePrpRate,
        suggestedFilRate,
        suggestedPolRate: suggestedPol,
        suggestedPrpRate: suggestedPrp,
        onDifficultyChange: (code) =>
          handleCardDifficultyChange(product, code),
        onPolOptionChange: (option) =>
          handleCardPolOptionChange(product, option),
        onDmCtgChange: (code) => handleCardDmCtgChange(product, code),
        onFilRateChange: (rate) => handleCardFilRateChange(product, rate),
        onPolRateChange: (rate) => handleCardPolRateChange(product, rate),
        onPrpRateChange: (rate) => handleCardPrpRateChange(product, rate),
        onSubmit: () => handleCardSubmit(product),
        canSubmit: isCardProductValid(product),
        submitState: cardSubmitStates[product.id] ?? "idle",
        submitMessage: cardSubmitMessages[product.id],
        polRates: polRates ?? [],
      };
    },
    [
      showCardRateEntry,
      editableRole,
      rateDataStatus,
      filledByDesign,
      rateEntries,
      user.role,
      difficultyRates,
      polRates,
      apiDifficultyCodes,
      polCategoryCodes,
      designDifficultiesByDmCtg,
      difficultyToDmCtg,
      handleCardDifficultyChange,
      handleCardPolOptionChange,
      handleCardDmCtgChange,
      handleCardFilRateChange,
      handleCardPolRateChange,
      handleCardPrpRateChange,
      handleCardSubmit,
      isCardProductValid,
      cardSubmitStates,
      cardSubmitMessages,
    ]
  );

  const stats = useMemo(() => {
    const totals = products.map(totalRate);
    const sum = totals.reduce((a, b) => a + b, 0);
    const avg = totals.length ? sum / totals.length : 0;
    const managers = new Set(products.map((p) => p.managerShort)).size;
    const max = Math.max(0, ...totals);
    return {
      count: products.length,
      avg,
      managers,
      max,
    };
  }, [products]);

  const listSummary = useMemo(() => {
    if (view === "entry" || view === "completed") {
      return {
        shown: entryListMeta.shown,
        total: entryListMeta.total,
        label:
          view === "completed"
            ? "Completed designs"
            : user.role === "MANAGER"
              ? "Ready for review"
              : "Pending designs",
        hint:
          view === "completed"
            ? "Visible / completed total"
            : "Visible / pending total",
      };
    }

    const shown = Math.min(visibleCount, activeList.length);
    const total = activeList.length;
    const isPendingGrid = view === "grid" && showCardRateEntry;

    return {
      shown,
      total,
      label: isPendingGrid ? "Pending designs" : "Designs in view",
      hint: query
        ? "Visible / filtered total"
        : isPendingGrid
          ? "Visible / pending total"
          : "Visible / total in list",
    };
  }, [
    view,
    entryListMeta,
    user.role,
    visibleCount,
    activeList.length,
    showCardRateEntry,
    query,
  ]);

  return (
    <section className="products-report">
      {hasProducts ? (
        <div className="products-report__stats">
          <StatCard
            label="Total designs"
            value={String(stats.count)}
            hint="In current report"
            accent="violet"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Avg total rate"
            value={inr(stats.avg)}
            hint="FIL + POL + PRP"
            accent="amber"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M4 19h16M6 16l3-5 3 3 4-7 2 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Highest total"
            value={inr(stats.max)}
            hint="Single design"
            accent="emerald"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M3 17l6-6 4 4 7-8M14 7h7v7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            label="Managers"
            value={String(stats.managers)}
            hint="Unique"
            accent="sky"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <StatCard
            label={listSummary.label}
            value={`${listSummary.shown} / ${listSummary.total}`}
            hint={listSummary.hint}
            accent="violet"
            icon={
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h16M4 18h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>
      ) : null}

      <div className="products-report__toolbar">
        <div className="products-report__search">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            className="products-report__search-icon"
          >
            <path
              d="M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.3-4.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="search"
            placeholder="Search by design, manager, customer code, manufacturer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="products-report__search-clear"
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="products-report__dates" role="group" aria-label="Date range">
          <label className="products-report__date">
            <span className="products-report__date-label">From</span>
            <input
              type="date"
              className="products-report__date-input"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => onFromDateChange(e.target.value)}
            />
          </label>
          <span className="products-report__date-separator" aria-hidden="true">
            –
          </span>
          <label className="products-report__date">
            <span className="products-report__date-label">To</span>
            <input
              type="date"
              className="products-report__date-input"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => onToDateChange(e.target.value)}
            />
          </label>
        </div>

        <div className="products-report__view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === "grid"}
            className={`products-report__view${view === "grid" ? " products-report__view--active" : ""
              }`}
            onClick={handleOpenGrid}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
                fill="currentColor"
              />
            </svg>
            Cards
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "table"}
            className={`products-report__view${view === "table" ? " products-report__view--active" : ""
              }`}
            onClick={() => setView("table")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M3 6h18M3 12h18M3 18h18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Table
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "entry"}
            className={`products-report__view${view === "entry" ? " products-report__view--active" : ""
              }`}
            onClick={handleOpenEntry}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M4 7h16M4 12h10M4 17h16M18 11l3 3-3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Rate entry
          </button>
          {showCompletedTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === "completed"}
              className={`products-report__view${view === "completed" ? " products-report__view--active" : ""
                }`}
              onClick={handleOpenCompleted}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Completed
            </button>
          ) : null}
        </div>
      </div>

      {load.status === "needs-dates" ? (
        <NeedsDatesState />
      ) : load.status === "loading" || load.status === "idle" ? (
        <LoadingDesignsState />
      ) : load.status === "error" ? (
        <DesignsError message={load.message} onRetry={onRetryLoad} />
      ) : (
        <>
          {view === "grid" && showCardRateEntry && rateDataStatus === "loading" ? (
            <div className="products-report__grid-rate-banner" role="status">
              <div className="products-report__rate-spinner" aria-hidden="true" />
              Loading rate options for quick entry…
            </div>
          ) : null}

          {view === "grid" && showCardRateEntry && rateDataStatus === "error" ? (
            <div className="products-report__grid-rate-banner products-report__grid-rate-banner--error">
              <span>Couldn&apos;t load rate data for card entry.</span>
              <button
                type="button"
                className="products-report__rate-retry"
                onClick={() => onLoadRateData?.()}
              >
                Retry
              </button>
            </div>
          ) : null}

          {view === "entry" ? (
            rateDataStatus === "ready" ? (
              <RateEntryView
                mode="pending"
                products={filtered}
                user={user}
                entries={rateEntries}
                onChange={handleRateChange}
                difficultyOptions={difficultyHeaders}
                difficultyRates={difficultyRates}
                polRates={polRates}
                filledRates={filledRates}
                completedFilDesignIds={completedFilDesignIds}
                completedPolDesignIds={completedPolDesignIds}
                designWiseDifficulties={designWiseDifficulties}
                onListMetaChange={handleEntryListMetaChange}
              />
            ) : rateDataStatus === "error" ? (
              <RateDataError onRetry={() => onLoadRateData?.()} />
            ) : (
              <RateDataLoading />
            )
          ) : view === "completed" ? (
            rateDataStatus === "ready" ? (
              <RateEntryView
                mode="completed"
                products={filtered}
                user={user}
                entries={rateEntries}
                onChange={handleRateChange}
                difficultyOptions={difficultyHeaders}
                difficultyRates={difficultyRates}
                polRates={polRates}
                filledRates={filledRates}
                completedFilDesignIds={completedFilDesignIds}
                completedPolDesignIds={completedPolDesignIds}
                designWiseDifficulties={designWiseDifficulties}
                onListMetaChange={handleEntryListMetaChange}
              />
            ) : rateDataStatus === "error" ? (
              <RateDataError onRetry={() => onLoadRateData?.()} />
            ) : (
              <RateDataLoading />
            )
          ) : filtered.length === 0 && !(view === "grid" && showCardRateEntry) ? (
            <div className="products-report__empty">
              {query ? (
                <>
                  <p>No designs match your search.</p>
                  <button type="button" onClick={() => setQuery("")}>
                    Clear search
                  </button>
                </>
              ) : (
                <p>
                  No designs were returned for {fromDate} – {toDate}. Try a
                  different date range.
                </p>
              )}
            </div>
          ) : view === "grid" ? (
            activeList.length === 0 ? (
              <div className="products-report__empty">
                {showCardRateEntry ? (
                  <p>
                    {user.role === "MANAGER"
                      ? "No designs are ready for manager review. FIL and POL must both be completed first."
                      : "All caught up — no pending designs in this list. Check the Completed tab or widen the date range."}
                  </p>
                ) : query ? (
                  <>
                    <p>No designs match your search.</p>
                    <button type="button" onClick={() => setQuery("")}>
                      Clear search
                    </button>
                  </>
                ) : (
                  <p>
                    No designs were returned for {fromDate} – {toDate}. Try a
                    different date range.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="products-report__grid">
                  {visibleProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      rateEntry={buildCardRateEntry(p)}
                    />
                  ))}
                </div>
                {hasMore ? (
                  <ShowMoreBar
                    remaining={remainingCount}
                    pageSize={PAGE_SIZE}
                    onShowMore={handleShowMore}
                  />
                ) : null}
              </>
            )
          ) : (
            <>
              <div className="products-report__table-wrap">
                <table className="products-report__table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Image</th>
                      <th rowSpan={2}>Design</th>
                      <th rowSpan={2}>Manager</th>
                      <th rowSpan={2}>Cust</th>
                      <th rowSpan={2}>Parts</th>
                      <th colSpan={3} className="products-report__th-group">
                        As per standard norms
                      </th>
                      <th
                        colSpan={
                          user.role === "POL"
                            ? 3
                            : user.role === "FIL"
                              ? 2
                              : 5
                        }
                        className="products-report__th-group products-report__th-group--accent"
                      >
                        System rate
                      </th>
                      <th rowSpan={2} className="products-report__th-total">
                        Total
                      </th>
                    </tr>
                    <tr>
                      {user.role === "FIL" ? (
                        <>
                          <th />
                          <th />
                          <th />
                          <th>Diff</th>
                          <th>FIL rate</th>
                        </>
                      ) : user.role === "POL" ? (
                        <>
                          <th />
                          <th />
                          <th />
                          <th>Diff</th>
                          <th>POL</th>
                          <th>PRP</th>
                        </>
                      ) : (
                        <>
                          <th>Diff</th>
                          <th>FIL</th>
                          <th>POL</th>
                          <th>PRP</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((p) => (
                      <ProductRow key={p.id} product={p} role={user.role} />
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore ? (
                <ShowMoreBar
                  remaining={remainingCount}
                  pageSize={PAGE_SIZE}
                  onShowMore={handleShowMore}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}

interface ShowMoreBarProps {
  remaining: number;
  pageSize: number;
  onShowMore: () => void;
}

function ShowMoreBar({ remaining, pageSize, onShowMore }: ShowMoreBarProps) {
  const loadCount = Math.min(pageSize, remaining);
  return (
    <div className="products-report__show-more">
      <button
        type="button"
        className="products-report__show-more-btn"
        onClick={onShowMore}
      >
        Show {loadCount} more
      </button>
      <span className="products-report__show-more-meta">
        {remaining} remaining
      </span>
    </div>
  );
}

function NeedsDatesState() {
  return (
    <div className="products-report__rate-state">
      <p className="products-report__rate-title">Pick a date range</p>
      <p className="products-report__rate-subtitle">
        Choose both a From and To date above to load designs.
      </p>
    </div>
  );
}

function LoadingDesignsState() {
  return (
    <div className="products-report__rate-state">
      <div className="products-report__rate-spinner" aria-hidden="true" />
      <p className="products-report__rate-title">Loading designs…</p>
      <p className="products-report__rate-subtitle">
        Fetching the latest data from the server.
      </p>
    </div>
  );
}

interface DesignsErrorProps {
  message: string;
  onRetry: () => void;
}

function DesignsError({ message, onRetry }: DesignsErrorProps) {
  return (
    <div className="products-report__rate-state products-report__rate-state--error">
      <p className="products-report__rate-title">Couldn’t load designs</p>
      <p className="products-report__rate-subtitle">{message}</p>
      <button
        type="button"
        className="products-report__rate-retry"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function RateDataLoading() {
  return (
    <div className="products-report__rate-state">
      <div className="products-report__rate-spinner" aria-hidden="true" />
      <p className="products-report__rate-title">Loading rate data…</p>
      <p className="products-report__rate-subtitle">
        Fetching rate data for your role.
      </p>
    </div>
  );
}

interface RateDataErrorProps {
  onRetry: () => void;
}

function RateDataError({ onRetry }: RateDataErrorProps) {
  return (
    <div className="products-report__rate-state products-report__rate-state--error">
      <p className="products-report__rate-title">Couldn’t load rate data</p>
      <p className="products-report__rate-subtitle">
        The server took too long or returned an error. Try again in a moment.
      </p>
      <button
        type="button"
        className="products-report__rate-retry"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
