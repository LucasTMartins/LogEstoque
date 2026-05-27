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
		this.setModel(new JSONModel({
			username: "",
			fullName: "",
			canManageMaterials: false,
			canManageMoviments: false,
			isAdmin: false,
			loaded: false
		}), "currentUser");
		this._loadCurrentUser();
	}

	private _loadCurrentUser(): void {
		const token = sessionStorage.getItem("token");
		const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

		fetch("/odata/v4/main/CurrentUser?$top=1", {
			credentials: "include",
			headers
		})
			.then((response) => response.ok ? response.json() : Promise.reject(response))
			.then((data: { value?: Array<Record<string, unknown>> }) => {
				const user = data.value?.[0];
				if (!user) { return; }

				(this.getModel("currentUser") as JSONModel | undefined)?.setData({
					...user,
					loaded: true
				});
				(this.getModel("userPerms") as JSONModel | undefined)?.setData({
					canManageMaterials: !!user.canManageMaterials,
					canManageMoviments: !!user.canManageMoviments,
					isAdmin: !!user.isAdmin
				});
			})
			.catch(() => {
				(this.getModel("currentUser") as JSONModel | undefined)?.setProperty("/loaded", false);
			});
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
