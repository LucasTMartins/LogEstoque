import AppComponent from "sap/fe/core/AppComponent";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace br.dev.imlucas.logestoque
 */
export default class Component extends AppComponent {

	public static metadata = {
		manifest: "json"
	};

	public init(): void {
		super.init();

		this.setModel(new JSONModel(this._getInitialUserPerms()), "userPerms");
	}

	private _getInitialUserPerms(): Record<string, boolean> {
		const mDefaults = {
			canManageMaterials: false,
			canManageMoviments: false,
			isAdmin: false
		};

		const token = sessionStorage.getItem("token");
		if (!token) { return mDefaults; }

		try {
			const raw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
			const padded = raw + "=".repeat((4 - raw.length % 4) % 4);
			const payload = JSON.parse(atob(padded)) as Record<string, unknown>;

			return {
				canManageMaterials: !!payload.canManageMaterials,
				canManageMoviments: !!payload.canManageMoviments,
				isAdmin: !!payload.isAdmin
			};
		} catch (_e) {
			return mDefaults;
		}
	}
}
