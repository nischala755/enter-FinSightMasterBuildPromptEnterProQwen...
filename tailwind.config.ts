import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				panel: {
					DEFAULT: 'hsl(var(--panel))',
					foreground: 'hsl(var(--panel-foreground))',
					border: 'hsl(var(--panel-border))',
				},
				brand: {
					DEFAULT: 'hsl(var(--brand))',
					foreground: 'hsl(var(--brand-foreground))',
					soft: 'hsl(var(--brand-soft))',
				},
				positive: {
					DEFAULT: 'hsl(var(--positive))',
					foreground: 'hsl(var(--positive-foreground))',
				},
				warn: {
					DEFAULT: 'hsl(var(--warn))',
					foreground: 'hsl(var(--warn-foreground))',
				},
				danger: {
					DEFAULT: 'hsl(var(--danger))',
					foreground: 'hsl(var(--danger-foreground))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background, 40 22% 97%))',
					foreground: 'hsl(var(--sidebar-foreground, 24 14% 30%))',
					primary: 'hsl(var(--sidebar-primary, 24 14% 12%))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground, 40 30% 97%))',
					accent: 'hsl(var(--sidebar-accent, 38 14% 90%))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground, 24 14% 12%))',
					border: 'hsl(var(--sidebar-border, 36 12% 85%))',
					ring: 'hsl(var(--sidebar-ring, 30 45% 40%))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					from: { opacity: '0', transform: 'translateY(4px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'pulse-node': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.45' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.4s ease-out',
				'pulse-node': 'pulse-node 1.6s ease-in-out infinite'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
