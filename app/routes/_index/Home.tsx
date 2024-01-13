import { FC } from "react";
import Layout from "~/components/Layout/Layout";
import Typography from "~/components/Typography/Typography";

const Home: FC = () => {
  return (
    <Layout>
      <Typography variant="heading">Lorem ipsum dolor sit amet</Typography>
      <Typography variant="heading">Lorem ipsum dolor sit amet</Typography>
      <Typography variant="subheading">Lorem ipsum dolor sit amet,</Typography>
      <Typography variant="body">
        <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
        exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor
        in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
        sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est
        laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
        incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
        exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor
        in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
        sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est
        laborum.
      </Typography>
      <button>Click ME</button>
      <pre>
        <code>{JSON.stringify({ foo: "bar" }, null, 2)}</code>
      </pre>
      <code>
        @method_decorator(login_required, name='dispatch') class OrderSuccess(View): template_name =
        'orders/order_success.html' form_class = UserAdditionalInfoForm # Common code for both get
        and post reqs def dispatch(self, request, *args, **kwargs): order_id =
        int(kwargs['order_id']) order = get_object_or_404(Order, pk=order_id) if order.user !=
        request.user: raise Http404 self.order = order return super().dispatch(request, *args,
        **kwargs) def get(self, request, order_id): user_additional_info_form = None if not
        request.user.first_name: user_additional_info_form = self.form_class( instance=request.user)
      </code>
    </Layout>
  );
};

export default Home;
