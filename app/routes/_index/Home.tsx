import { FC } from "react";
import Layout from "~/components/Layout/Layout";

const Home: FC = () => {
    return (<Layout>
        <h1>Lorem ipsum dolor sit amet</h1>
        <h2>Lorem ipsum dolor sit amet,</h2>
        <h3>Lorem ipsum dolor sit amet,</h3>
        <h4>Lorem ipsum dolor sit amet,</h4>
        <h5>Lorem ipsum dolor sit amet,</h5>
        <h6>Lorem ipsum dolor sit amet,</h6>
        <p>
            <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </p>
        <button>Click ME</button>
        <pre>
            <code>
                {JSON.stringify({ foo: 'bar' }, null, 2)}
            </code>
        </pre>
        <code>
            @method_decorator(login_required, name='dispatch')
            class OrderSuccess(View):
            template_name = 'orders/order_success.html'
            form_class = UserAdditionalInfoForm

            # Common code for both get and post reqs
            def dispatch(self, request, *args, **kwargs):
            order_id = int(kwargs['order_id'])
            order = get_object_or_404(Order, pk=order_id)
            if order.user != request.user:
            raise Http404
            self.order = order
            return super().dispatch(request, *args, **kwargs)

            def get(self, request, order_id):
            user_additional_info_form = None
            if not request.user.first_name:
            user_additional_info_form = self.form_class(
            instance=request.user)

        </code>
    </Layout>)
}


export default Home