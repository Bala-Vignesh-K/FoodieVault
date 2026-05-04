export const colors = {
  backgroundPrimary: "#FDFBF7",
  backgroundSecondary: "#F3EFEA",
  primary: "#E05D3A",
  primaryHover: "#C94B2A",
  primarySoft: "#FBE8E0",
  secondary: "#7A8B76",
  secondaryHover: "#657662",
  textPrimary: "#1A1714",
  textSecondary: "#6A645D",
  textTertiary: "#A19A8F",
  border: "#E5E0D8",
  borderSoft: "#EFEAE3",
  error: "#D34C4C",
  success: "#7A8B76",
  cardBg: "#FFFFFF",
  overlay: "rgba(26, 23, 20, 0.4)",
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#000000",
  swiggyOrange: "#FC8019",
};

export const radii = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const shadows = {
  soft: {
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  medium: {
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  primary: {
    shadowColor: "#E05D3A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
};

export const typography = {
  h1: { fontSize: 40, fontWeight: "900" as const, letterSpacing: -1.2, lineHeight: 44 },
  h2: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.6, lineHeight: 34 },
  h3: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4, lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: "700" as const, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "500" as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: "500" as const, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: "800" as const, letterSpacing: 2, textTransform: "uppercase" as const },
  button: { fontSize: 16, fontWeight: "700" as const, letterSpacing: -0.2 },
};
