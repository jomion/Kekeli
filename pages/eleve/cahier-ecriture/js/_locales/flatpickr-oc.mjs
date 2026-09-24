export const flatpickrOccitan = {
	firstDayOfWeek: 1,
	weekdays: {
		shorthand: ["dim", "dl", "dma", "dme", "dj", "dv", "ds"],
		longhand: [
			"dimenge",
			"diluns",
			"dimars",
			"dimècres",
			"dijòus",
			"divendres",
			"dissabte",
		],
	},
	months: {
		shorthand: [
			"gen",
			"febr",
			"març",
			"abr",
			"mai",
			"jun",
			"jul",
			"ag",
			"set",
			"oct",
			"nov",
			"dec",
		],
		longhand: [
			"genièr",
			"febrièr",
			"març",
			"abril",
			"mai",
			"junh",
			"julhet",
			"agost",
			"setembre",
			"octobre",
			"novembre",
			"decembre",
		],
	},
	ordinal: function (nth) {
		if (nth > 1) return "";
		return "èr";
	},
	rangeSeparator: " a ",
	weekAbbreviation: "Sem",
	scrollTitle: "Desfilar per aumentar",
	toggleTitle: "Clicar per bascular",
	time_24hr: true,
};
